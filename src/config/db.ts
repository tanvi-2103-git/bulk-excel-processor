import { Pool, PoolConfig } from "pg";
import * as dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_DATABASE || "bulk_excel_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

export const pool = new Pool(poolConfig);

pool.on("connect", () => {
  logger.debug("Database client connected");
});

pool.on("error", (err: Error) => {
  logger.error("Unexpected database pool error", { error: err.message });
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    logger.info("Database connection verified");
    return true;
  } catch (error) {
    const err = error as Error;
    logger.error("Database connection failed", { error: err.message });
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
  logger.info("Database pool closed");
}
