import { pool } from "./config/db"
import { logger } from "./utils/logger"

async function insertBatch(data: any[]) {

  const client = await pool.connect()

  try {

    logger.debug("Starting batch insert", { size: data.length })

    await client.query("BEGIN")

    const query =
      `INSERT INTO users(name,email,age) VALUES ${data
        .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
        .join(",")}`

    const values = data.flatMap(d => [d.name, d.email, d.age])

    await client.query(query, values)

    await client.query("COMMIT")

    logger.info("Batch inserted successfully", { size: data.length })

  } catch (e: any) {

    await client.query("ROLLBACK")

    logger.error("Batch insert failed", {
      error: e.message,
      size: data.length
    })

    throw e

  } finally {

    client.release()

  }
}

export default async function insertWithRetry(
  data: any[],
  retries = 3
): Promise<boolean> {

  try {

    await insertBatch(data)
    return true

  } catch (e: any) {

    logger.debug("Retrying batch", { retriesLeft: retries })

    if (retries > 0) {
      return await insertWithRetry(data, retries - 1)
    } else {

      logger.error("Batch failed after all retries", { size: data.length })

      const client = await pool.connect()

      for (const row of data) {
        await client.query(
          "INSERT INTO error_rows(data,reason) VALUES($1,$2)",
          [row, "Batch failed after retries"]
        )
      }

      client.release()

      return false
    }
  }
}
