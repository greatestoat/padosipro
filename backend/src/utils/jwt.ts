import jwt, { JsonWebTokenError, JwtPayload, SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthTokenClaims {
  userId: string;
  email: string;
}

/** Signs a token and returns it with its lifetime in seconds (handy for the app). */
export function signAccessToken(userId: string, email: string) {
  const token = jwt.sign({ email }, env.JWT_SECRET, {
    subject: userId,
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });

  const decoded = jwt.decode(token) as JwtPayload;
  return { token, expiresIn: (decoded.exp as number) - (decoded.iat as number) };
}

/** Throws TokenExpiredError / JsonWebTokenError if the token is not acceptable. */
export function verifyAccessToken(token: string): AuthTokenClaims {
  // Pin the algorithm so a token can't pick a weaker one (e.g. "none").
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });

  if (typeof payload === "string" || !payload.sub) {
    throw new JsonWebTokenError("Invalid token payload");
  }
  return { userId: payload.sub, email: String(payload.email ?? "") };
}