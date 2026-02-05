import express, { Request, Response } from "express";
import * as dotenv from "dotenv";
import uploadRoutes from "./routes/upload.routes";
import { errorHandler } from "./middlewares/error.middleware";
import { logger } from "./utils/logger";
import { testConnection, closePool } from "./config/db";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Service is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", uploadRoutes);

app.use(errorHandler);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

async function startServer(): Promise<void> {
  const dbConnected = await testConnection();

  if (!dbConnected) {
    logger.error("Failed to connect to database. Exiting.");
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info("Server started", { port: PORT, env: process.env.NODE_ENV || "development" });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Shutdown signal received", { signal });

    server.close(async () => {
      logger.info("HTTP server closed");
      await closePool();
      logger.info("Graceful shutdown completed");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown due to timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (error: Error) => {
    logger.error("Uncaught exception", { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    logger.error("Unhandled rejection", { reason: String(reason) });
  });
}

startServer();
