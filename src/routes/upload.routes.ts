import express from "express";
import multer from "multer";
import { uploadExcel, getProgress } from "../controllers/upload.controller";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), uploadExcel);
router.get("/progress", getProgress);

export default router;
