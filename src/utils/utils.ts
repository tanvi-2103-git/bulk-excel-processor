import Piscina from "piscina";
import path from "path";

const isDev = __filename.endsWith('.ts');

export const piscina = new Piscina({
  filename: path.resolve(__dirname, isDev ? "../worker.ts" : "../worker.js"),
  execArgv: isDev ? ["-r", "ts-node/register"] : [],
});
