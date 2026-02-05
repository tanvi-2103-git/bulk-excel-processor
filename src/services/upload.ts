import ExcelJS from "exceljs";
import fs from "fs";
import { piscina } from "../utils/utils";
import { pool } from "../config/db";
import { logger } from "../utils/logger";
import { UserRow, RawRowData, ProcessingResult } from "../types";

const BATCH_SIZE = 2000;

function validateRow(data: RawRowData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || (typeof data.name === "string" && data.name.trim() === "")) {
    errors.push("Missing or empty name");
  }

  if (!data.email || (typeof data.email === "string" && data.email.trim() === "")) {
    errors.push("Missing or empty email");
  } else if (typeof data.email === "string" && !isValidEmail(data.email)) {
    errors.push("Invalid email format");
  }

  if (data.age === null || data.age === undefined) {
    errors.push("Missing age");
  } else if (typeof data.age !== "number" || !Number.isInteger(data.age) || data.age < 0) {
    errors.push("Invalid age (must be a positive integer)");
  }

  return { valid: errors.length === 0, errors };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug("Temporary file cleaned up", { filePath });
    }
  } catch (error) {
    const err = error as Error;
    logger.warn("Failed to cleanup temporary file", { filePath, error: err.message });
  }
}

async function updateProgress(
  progressId: number,
  processed: number,
  failed: number,
  batchNo: number,
  totalRows: number,
  status?: string
): Promise<void> {
  const query = status
    ? "UPDATE upload_progress SET processed_rows=$1, failed_rows=$2, batch_no=$3, total_rows=$4, status=$5 WHERE id=$6"
    : "UPDATE upload_progress SET processed_rows=$1, failed_rows=$2, batch_no=$3, total_rows=$4 WHERE id=$5";

  const params = status
    ? [processed, failed, batchNo, totalRows, status, progressId]
    : [processed, failed, batchNo, totalRows, progressId];

  await pool.query(query, params);
}

async function logErrorRow(data: RawRowData, reason: string): Promise<void> {
  try {
    await pool.query(
      "INSERT INTO error_rows(data, reason) VALUES($1, $2)",
      [JSON.stringify(data), reason]
    );
  } catch (error) {
    const err = error as Error;
    logger.error("Failed to log error row", { error: err.message });
  }
}

export async function processExcel(filePath: string): Promise<ProcessingResult> {
  logger.info("Excel processing started", { filePath });

  let batch: UserRow[] = [];
  let processed = 0;
  let failed = 0;
  let batchNo = 0;
  let totalRows = 0;
  let progressId = 0;

  try {
    const result = await pool.query(
      "INSERT INTO upload_progress(total_rows, processed_rows, failed_rows, batch_no, status) VALUES(0, 0, 0, 0, 'processing') RETURNING id"
    );
    progressId = result.rows[0].id;

    logger.info("Progress tracking created", { progressId });

    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {});

    let worksheetIndex = 0;
    for await (const worksheet of workbook) {
      worksheetIndex++;
      logger.debug("Processing worksheet", { index: worksheetIndex });

      for await (const row of worksheet) {
        if (row.number === 1) continue;

        totalRows++;

        const rawData: RawRowData = {
          name: row.getCell(1).value,
          email: row.getCell(2).value,
          age: row.getCell(3).value,
        };

        const validation = validateRow(rawData);

        if (!validation.valid) {
          failed++;
          const reason = `Validation error: ${validation.errors.join(", ")}`;
          logger.debug("Row validation failed", { row: row.number, errors: validation.errors });
          await logErrorRow(rawData, reason);
          continue;
        }

        const userRow: UserRow = {
          name: String(rawData.name),
          email: String(rawData.email),
          age: rawData.age as number,
        };

        batch.push(userRow);

        if (batch.length >= BATCH_SIZE) {
          batchNo++;
          logger.info("Processing batch", { batchNo, size: batch.length });

          const success = await piscina.run(batch);

          if (success) {
            processed += batch.length;
            logger.info("Batch completed successfully", { batchNo });
          } else {
            failed += batch.length;
            logger.error("Batch processing failed", { batchNo });
          }

          await updateProgress(progressId, processed, failed, batchNo, totalRows);
          logger.debug("Progress updated", { processed, failed, batchNo, totalRows });

          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      batchNo++;
      logger.info("Processing final batch", { batchNo, size: batch.length });

      const success = await piscina.run(batch);

      if (success) {
        processed += batch.length;
        logger.info("Final batch completed successfully", { batchNo });
      } else {
        failed += batch.length;
        logger.error("Final batch processing failed", { batchNo });
      }

      await updateProgress(progressId, processed, failed, batchNo, totalRows);
    }

    await updateProgress(progressId, processed, failed, batchNo, totalRows, "completed");

    logger.info("Excel processing completed", {
      progressId,
      totalRows,
      processed,
      failed,
      batches: batchNo,
    });

    return { processed, failed, batches: batchNo, progressId };
  } catch (error) {
    const err = error as Error;
    logger.error("Excel processing failed", {
      progressId,
      error: err.message,
      stack: err.stack,
    });

    if (progressId > 0) {
      await updateProgress(progressId, processed, failed, batchNo, totalRows, "failed");
    }

    throw error;
  } finally {
    cleanupFile(filePath);
  }
}
