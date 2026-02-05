import fs from "fs"

type Level = "DEBUG" | "INFO" | "ERROR"

const stream = fs.createWriteStream("app.log", { flags: "a" })

const LEVEL_ORDER: Record<Level, number> = {
  DEBUG: 1,
  INFO: 2,
  ERROR: 3
}

const CURRENT_LEVEL = (process.env.LOG_LEVEL as Level) || "INFO"

function log(level: Level, message: string, meta?: any) {

  if (LEVEL_ORDER[level] < LEVEL_ORDER[CURRENT_LEVEL]) return

  const entry = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    meta
  })

  stream.write(entry + "\n")
  console.log(entry)
}

export const logger = {
  debug: (msg: string, meta?: any) => log("DEBUG", msg, meta),
  info: (msg: string, meta?: any) => log("INFO", msg, meta),
  error: (msg: string, meta?: any) => log("ERROR", msg, meta)
}
