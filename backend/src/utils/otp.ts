import crypto from "crypto";
import { env } from "../config/env";

/** Cryptographically secure, always exactly 6 digits (leading zeros kept). */
export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * HMAC-SHA256 keyed with a server secret and bound to the user id.
 * A leaked DB alone can't be brute-forced offline, and a code from one
 * user's row can't be replayed against another's.
 */
export function hashOtp(userId: string, code: string): string {
  return crypto
    .createHmac("sha256", env.OTP_HMAC_SECRET)
    .update(`${userId}:${code}`)
    .digest("hex");
}

/** Constant-time comparison so response timing leaks nothing. */
export function otpMatches(userId: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(userId, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}