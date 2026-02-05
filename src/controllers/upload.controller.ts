import { Request, Response, NextFunction } from "express";
import { processExcel } from "../services/upload";
import { pool } from "../config/db";
import { logger } from "../utils/logger";
import { AppError, HttpStatus, UploadProgress, FileUploadRequest } from "../types";

export async function uploadExcel(
  req: FileUploadRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      logger.warn("Upload attempt without file");
      throw new AppError("No file uploaded", HttpStatus.BAD_REQUEST);
    }

    logger.info("Excel upload received", {
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path,
    });

    processExcel(req.file.path).catch((error: Error) => {
      logger.error("Background processing failed", {
        error: error.message,
        file: req.file?.path,
      });
    });

    logger.info("Background processing initiated");

    res.status(HttpStatus.OK).json({
      success: true,
      message: "File uploaded successfully. Processing started in background.",
      data: {
        filename: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getProgress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    const progressId = typeof id === "string" ? id : undefined;

    logger.debug("Fetching upload progress", { id: progressId });

    let query: string;
    let params: number[];

    if (progressId) {
      query = "SELECT * FROM upload_progress WHERE id = $1";
      params = [parseInt(progressId, 10)];
    } else {
      query = "SELECT * FROM upload_progress ORDER BY id DESC LIMIT 1";
      params = [];
    }

    const result = await pool.query<UploadProgress>(query, params);

    if (result.rows.length === 0) {
      throw new AppError("No progress record found", HttpStatus.NOT_FOUND);
    }

    const progress = result.rows[0];

    logger.info("Progress fetched", {
      id: progress.id,
      processed: progress.processed_rows,
      failed: progress.failed_rows,
    });

    res.status(HttpStatus.OK).json({
      success: true,
      message: "Progress retrieved successfully",
      data: progress,
    });
  } catch (error) {
    next(error);
  }
}
