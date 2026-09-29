import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { generateOtp, hashOtp, otpMatches } from "../utils/otp";

/**
 * Creates a new OTP for the user and returns the RAW code (for the email only).
 * - Enforces the resend cooldown.
 * - Invalidates all earlier unused codes, so only the newest code is ever valid.
 */
export async function issueOtp(userId: string): Promise<string> {
  const latest = await prisma.otpVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    const elapsedSeconds = (Date.now() - latest.createdAt.getTime()) / 1000;
    if (elapsedSeconds < env.OTP_RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new AppError(
        429,
        "OTP_RESEND_COOLDOWN",
        `Please wait ${wait} seconds before requesting a new code`
      );
    }
  }

  const code = generateOtp();

  await prisma.$transaction([
    prisma.otpVerification.updateMany({
      where: { userId, used: false },
      data: { used: true },
    }),
    prisma.otpVerification.create({
      data: {
        userId,
        codeHash: hashOtp(userId, code),
        expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000),
      },
    }),
  ]);

  return code;
}

/**
 * Verifies a code and, on success, consumes it and marks the user verified.
 */
export async function verifyOtp(userId: string, code: string): Promise<void> {
  const otp = await prisma.otpVerification.findFirst({
    where: { userId, used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw new AppError(400, "OTP_INVALID", "No active code found. Please request a new one");
  }

  if (otp.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, "OTP_EXPIRED", "This code has expired. Please request a new one");
  }

  // Count the attempt atomically BEFORE comparing. Parallel guesses can't
  // slip past the limit, because each request gets its own incremented value.
  const updated = await prisma.otpVerification.update({
    where: { id: otp.id },
    data: { attempts: { increment: 1 } },
  });

  if (updated.attempts > env.OTP_MAX_ATTEMPTS) {
    throw new AppError(
      429,
      "OTP_MAX_ATTEMPTS",
      "Too many incorrect attempts. Please request a new code"
    );
  }

  if (!otpMatches(userId, code, otp.codeHash)) {
    const remaining = env.OTP_MAX_ATTEMPTS - updated.attempts;
    throw new AppError(
      400,
      "OTP_INVALID",
      remaining > 0
        ? `Incorrect code. ${remaining} attempt(s) remaining`
        : "Incorrect code. No attempts remaining. Please request a new code"
    );
  }

  // Consume the code and verify the user atomically. `updateMany` with
  // `used: false` in the filter guarantees single use, even under a race:
  // only one request can flip the flag.
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.otpVerification.updateMany({
      where: { id: otp.id, used: false },
      data: { used: true },
    });
    if (consumed.count !== 1) {
      throw new AppError(400, "OTP_INVALID", "This code has already been used");
    }
    await tx.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  });
}