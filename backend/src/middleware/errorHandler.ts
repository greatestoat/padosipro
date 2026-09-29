import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { sendError } from "../utils/apiResponse";
import { env } from "../config/env";

export function notFoundHandler(req: Request, res: Response) {
  return sendError(res, 404, "ROUTE_NOT_FOUND", `Route ${req.method} ${req.path} not found`);
}

// Express identifies error middleware by its 4 arguments — keep `_next`.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const errors = err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return sendError(res, 400, "VALIDATION_ERROR", "Validation failed", errors);
  }

  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.errorCode, err.message);
  }

  // Malformed JSON body (thrown by express.json())
  if (err instanceof SyntaxError && "body" in err) {
    return sendError(res, 400, "INVALID_JSON", "Request body contains invalid JSON");
  }

  console.error("Unhandled error:", err);
  const message =
    env.NODE_ENV === "production"
      ? "Something went wrong"
      : err instanceof Error
        ? err.message
        : "Something went wrong";
  return sendError(res, 500, "INTERNAL_SERVER_ERROR", message);
}