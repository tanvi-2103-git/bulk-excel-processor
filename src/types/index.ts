import { Request, Response, NextFunction } from "express";

export interface UserRow {
  name: string;
  email: string;
  age: number;
}

export interface RawRowData {
  name: unknown;
  email: unknown;
  age: unknown;
}

export interface UploadProgress {
  id: number;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  batch_no: number;
  status?: "processing" | "completed" | "failed";
  created_at?: Date;
  updated_at?: Date;
}

export interface ErrorRow {
  data: RawRowData;
  reason: string;
}

export interface ProcessingResult {
  processed: number;
  failed: number;
  batches: number;
  progressId: number;
}

export interface FileUploadRequest extends Request {
  file?: Express.Multer.File;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface ApiErrorResponse {
  success: boolean;
  message: string;
  error?: string;
  stack?: string;
}

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
