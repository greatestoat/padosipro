import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

/**
 * Validates req.body against a Zod schema and replaces it with the parsed
 * (trimmed, lowercased, typed) result. On failure it throws a ZodError,
 * which the central errorHandler turns into a 400 VALIDATION_ERROR.
 */
export const validateBody =
  (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };