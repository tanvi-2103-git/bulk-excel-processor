import { logger } from "../utils/logger"

export function errorHandler(err: any, req: any, res: any, next: any) {

  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    status: err.status,
    path: req.originalUrl,
    method: req.method
  })

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error"
  })
}
