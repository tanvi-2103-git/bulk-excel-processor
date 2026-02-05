import express from "express";
import uploadRoutes from "./routes/upload.routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(express.json());

app.use(uploadRoutes);

app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server running on 3000");
});
