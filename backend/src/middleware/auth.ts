import { TokenExpiredError } from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";
import { verifyAccessToken } from "../utils/jwt";

// Adds `req.user` to Express's Request type so controllers get it fully typed.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  }

  const token = header.slice("Bearer ".length).trim();

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      throw new AppError(401, "TOKEN_EXPIRED", "Your session has expired. Please log in again");
    }
    throw new AppError(401, "INVALID_TOKEN", "Invalid authentication token");
  }

  // A valid signature isn't enough: the account must still exist and be verified.
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, emailVerified: true },
  });

  if (!user || !user.emailVerified) {
    throw new AppError(401, "INVALID_TOKEN", "Invalid authentication token");
  }

  req.user = { id: user.id, email: user.email };
  next();
});