import { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  message: string,
  data: T | Record<string, never> = {},
  statusCode = 200
) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendError(
  res: Response,
  statusCode: number,
  errorCode: string,
  message: string,
  errors?: Array<{ field: string; message: string }>
) {
  return res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    ...(errors ? { errors } : {}),
  });
}