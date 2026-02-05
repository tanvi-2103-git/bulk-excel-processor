import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { AppError, HttpStatus } from "../types";
import multer from "multer";

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.status || err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
  let message = err.message || "Internal Server Error";

  if (err instanceof multer.MulterError) {
    statusCode = HttpStatus.BAD_REQUEST;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File size exceeds the maximum allowed limit (50MB)";
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  logger.error("Request error", {
    message: err.message,
    stack: err.stack,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  const isProduction = process.env.NODE_ENV === "production";

  res.status(statusCode).json({
    success: false,
    message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
