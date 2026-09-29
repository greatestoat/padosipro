import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import * as otpService from "./otp.service";
import { sendOtpEmail } from "./mail.service";
import { signAccessToken } from "../utils/jwt";
const BCRYPT_ROUNDS = 12;

const otpMeta = () => ({
  otpExpiresInMinutes: env.OTP_TTL_MINUTES,
  resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
});

export async function register(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.emailVerified) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "This email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let userId: string;

  if (existing) {
    // Registered earlier but never verified: allow retrying. Issue the OTP
    // first so the cooldown is enforced before anything changes.
    userId = existing.id;
    const code = await otpService.issueOtp(userId);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await sendOtpEmail(email, code);
  } else {
    try {
      const user = await prisma.user.create({ data: { email, passwordHash } });
      userId = user.id;
    } catch (err) {
      // Two simultaneous registrations: the DB unique constraint is the referee.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "This email is already registered");
      }
      throw err;
    }
    const code = await otpService.issueOtp(userId);
    await sendOtpEmail(email, code);
  }

  return { email, ...otpMeta() };
}

export async function verifyEmail(email: string, otp: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same error for "unknown email" and "wrong code": doesn't reveal which emails exist.
  if (!user) {
    throw new AppError(400, "OTP_INVALID", "Invalid or expired code");
  }
  if (user.emailVerified) {
    throw new AppError(400, "ALREADY_VERIFIED", "This email is already verified. Please log in");
  }

  await otpService.verifyOtp(user.id, otp);
  return { email, emailVerified: true };
}

export async function resendOtp(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Generic result for unknown or already-verified emails (no account enumeration).
  if (user && !user.emailVerified) {
    const code = await otpService.issueOtp(user.id);
    await sendOtpEmail(email, code);
  }

  return { resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS };
}
// Used when the email doesn't exist, so "unknown email" takes as long as
// "wrong password" and response timing can't reveal which emails are registered.
let dummyHashPromise: Promise<string> | undefined;
const getDummyHash = () => (dummyHashPromise ??= bcrypt.hash("not-a-real-password", BCRYPT_ROUNDS));

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !passwordOk) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }

  // Checked AFTER the password, so only someone who knows the password
  // learns that the account exists but is unverified.
  if (!user.emailVerified) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email before logging in");
  }

  // Routing flags are computed from real data, never stored, so they can't go stale.
  const [profile, selectedTask] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    prisma.userTask.findFirst({ where: { userId: user.id }, select: { id: true } }),
  ]);

  const { token, expiresIn } = signAccessToken(user.id, user.email);

  return {
    token,
    tokenType: "Bearer" as const,
    expiresIn, // seconds
    user: {
      id: user.id,
      email: user.email,
      profileCompleted: profile !== null,
      hasSelectedTasks: selectedTask !== null,
    },
  };
}