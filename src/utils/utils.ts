import Piscina from "piscina";
import path from "path";

const isDev = process.env.NODE_ENV !== "production" && __filename.endsWith(".ts");

const workerFilename = isDev ? "worker.ts" : "worker.js";
const workerPath = path.resolve(__dirname, "..", workerFilename);

export const piscina = new Piscina({
  filename: workerPath,
  execArgv: isDev ? ["-r", "ts-node/register"] : [],
  minThreads: 2,
  maxThreads: 4,
  idleTimeout: 30000,
});

piscina.on("error", (error: Error) => {
  console.error("Piscina worker error:", error.message);
});
