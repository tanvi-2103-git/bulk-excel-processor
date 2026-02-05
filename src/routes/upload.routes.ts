import { Router } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { uploadExcel, getProgress } from "../controllers/upload.controller";
import { AppError, HttpStatus } from "../types";

const router = Router();

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.diskStorage({
  destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadsDir);
  },
  filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new AppError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`, HttpStatus.BAD_REQUEST));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

router.post("/upload", upload.single("file"), uploadExcel);
router.get("/progress", getProgress);
router.get("/progress/:id", getProgress);

export default router;
