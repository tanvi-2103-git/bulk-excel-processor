import ExcelJS from "exceljs"
import { piscina } from "../utils/utils"
import { pool } from "../config/db"
import { logger } from "../utils/logger"

const BATCH_SIZE = 2000

export async function processExcel(filePath: string) {

  logger.info("Excel processing started", { filePath })

  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {})

  let batch: any[] = []
  let processed = 0
  let failed = 0
  let batchNo = 0

  const result = await pool.query(
    "INSERT INTO upload_progress(total_rows,processed_rows,failed_rows,batch_no) VALUES(0,0,0,0) RETURNING id"
  )

  const progressId = result.rows[0].id

  logger.info("Progress tracking created", { progressId })

  for await (const worksheet of workbook) {

    logger.debug("Worksheet started")

    for await (const row of worksheet) {

      if (row.number === 1) continue

      const obj = {
        name: row.getCell(1).value,
        email: row.getCell(2).value,
        age: row.getCell(3).value
      }

      if (!obj.name || !obj.email || typeof obj.age !== "number") {

        failed++

        logger.debug("Validation failed", obj)

        await pool.query(
          "INSERT INTO error_rows(data,reason) VALUES($1,$2)",
          [obj, "Validation failed"]
        )

        continue
      }

      batch.push(obj)

      if (batch.length === BATCH_SIZE) {

        batchNo++

        logger.info("Processing batch", {
          batchNo,
          size: batch.length
        })

        const success = await piscina.run(batch)

        if (success) {
          processed += batch.length
          logger.info("Batch success", { batchNo })
        } else {
          failed += batch.length
          logger.error("Batch failed", { batchNo })
        }

        await pool.query(
          "UPDATE upload_progress SET processed_rows=$1, failed_rows=$2, batch_no=$3 WHERE id=$4",
          [processed, failed, batchNo, progressId]
        )

        logger.debug("Progress updated", {
          processed,
          failed,
          batchNo
        })

        batch = []
      }
    }
  }

  if (batch.length > 0) {

    batchNo++

    logger.info("Processing final batch", {
      batchNo,
      size: batch.length
    })

    const success = await piscina.run(batch)

    if (success) {
      processed += batch.length
      logger.info("Final batch success", { batchNo })
    } else {
      failed += batch.length
      logger.error("Final batch failed", { batchNo })
    }

    await pool.query(
      "UPDATE upload_progress SET processed_rows=$1, failed_rows=$2, batch_no=$3 WHERE id=$4",
      [processed, failed, batchNo, progressId]
    )
  }

  logger.info("Excel processing completed", {
    processed,
    failed,
    batches: batchNo
  })
}
