import fs from "fs";
import path from "path";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const VALID_LEVELS = Object.keys(LOG_LEVELS);

function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && VALID_LEVELS.includes(envLevel)) {
    return envLevel as LogLevel;
  }
  return "INFO";
}

const logsDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, "app.log");
const stream = fs.createWriteStream(logFilePath, { flags: "a" });

stream.on("error", (err: Error) => {
  console.error("Logger stream error:", err.message);
});

const currentLevel = getLogLevel();

function formatMessage(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta && Object.keys(meta).length > 0 && { meta }),
  };

  const formatted = formatMessage(entry);

  stream.write(formatted + "\n");

  const colorMap: Record<LogLevel, string> = {
    DEBUG: "\x1b[36m",
    INFO: "\x1b[32m",
    WARN: "\x1b[33m",
    ERROR: "\x1b[31m",
  };
  const reset = "\x1b[0m";

  console.log(`${colorMap[level]}${formatted}${reset}`);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>): void => log("DEBUG", message, meta),
  info: (message: string, meta?: Record<string, unknown>): void => log("INFO", message, meta),
  warn: (message: string, meta?: Record<string, unknown>): void => log("WARN", message, meta),
  error: (message: string, meta?: Record<string, unknown>): void => log("ERROR", message, meta),
};
