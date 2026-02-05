import { pool } from "./config/db";
import { logger } from "./utils/logger";

interface UserRow {
  name: string;
  email: string;
  age: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function insertBatch(data: UserRow[]): Promise<void> {
  const client = await pool.connect();

  try {
    logger.debug("Starting batch insert", { size: data.length });

    await client.query("BEGIN");

    const placeholders = data
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(", ");

    const query = `INSERT INTO users(name, email, age) VALUES ${placeholders}`;
    const values = data.flatMap((row) => [row.name, row.email, row.age]);

    await client.query(query, values);
    await client.query("COMMIT");

    logger.info("Batch inserted successfully", { size: data.length });
  } catch (error) {
    await client.query("ROLLBACK");

    const err = error as Error;
    logger.error("Batch insert failed", {
      error: err.message,
      size: data.length,
    });

    throw error;
  } finally {
    client.release();
  }
}

async function logFailedRows(data: UserRow[], reason: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const row of data) {
      await client.query(
        "INSERT INTO error_rows(data, reason) VALUES($1, $2)",
        [JSON.stringify(row), reason]
      );
    }

    await client.query("COMMIT");
    logger.debug("Failed rows logged to error_rows table", { count: data.length });
  } catch (error) {
    await client.query("ROLLBACK");
    const err = error as Error;
    logger.error("Failed to log error rows", { error: err.message });
  } finally {
    client.release();
  }
}

export default async function insertWithRetry(
  data: UserRow[],
  retries: number = MAX_RETRIES
): Promise<boolean> {
  if (!data || data.length === 0) {
    logger.warn("Empty batch received, skipping");
    return true;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await insertBatch(data);
      return true;
    } catch (error) {
      const err = error as Error;
      const reason = err.message || "Unknown database error";

      logger.warn("Batch insert attempt failed", {
        attempt,
        maxRetries: retries,
        reason,
        batchSize: data.length,
      });

      if (attempt < retries) {
        const delayMs = RETRY_DELAY_MS * attempt;
        logger.debug("Waiting before retry", { delayMs });
        await delay(delayMs);
      } else {
        logger.error("Batch failed after all retries", {
          attempts: retries,
          reason,
          batchSize: data.length,
        });

        await logFailedRows(data, `Database error after ${retries} retries: ${reason}`);
        return false;
      }
    }
  }

  return false;
}
