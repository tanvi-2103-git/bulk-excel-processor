import { processExcel } from "../services/upload"
import { pool } from "../config/db"
import { logger } from "../utils/logger"

export async function uploadExcel(req: any, res: any) {

  if (!req.file) {

    logger.error("Upload failed - no file provided")

    throw new Error("No file uploaded")
  }

  logger.info("Excel upload received", {
    file: req.file.originalname,
    path: req.file.path
  })

  processExcel(req.file.path)

  logger.info("Background processing started")

  res.json({ message: "Processing started in background" })
}

export async function getProgress(req: any, res: any) {

  logger.debug("Fetching upload progress")

  const result = await pool.query(
    "SELECT * FROM upload_progress ORDER BY id DESC LIMIT 1"
  )

  logger.info("Progress fetched", result.rows[0])

  res.json(result.rows[0])
}
