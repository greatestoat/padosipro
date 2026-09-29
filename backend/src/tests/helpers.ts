import bcrypt from "bcrypt";
import request from "supertest";
import { expect, vi } from "vitest";
import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { sendOtpEmail } from "../services/mail.service";

export const app = createApp();
export const api = () => request(app);
export const PASSWORD = "Passw0rd123";

/** Deleting users cascades to their profile, OTPs and task selections. */
export async function resetDb() {
  await prisma.user.deleteMany();
}

// ---- HTTP shortcuts -------------------------------------------------------

export const register = (email: string, password = PASSWORD) =>
  api().post("/api/auth/register").send({ email, password, confirmPassword: password });

export const verify = (email: string, otp: string) =>
  api().post("/api/auth/verify-otp").send({ email, otp });

export const resend = (email: string) => api().post("/api/auth/resend-otp").send({ email });

export const login = (email: string, password = PASSWORD) =>
  api().post("/api/auth/login").send({ email, password });

// ---- OTP helpers ----------------------------------------------------------

export const emailsSent = () => vi.mocked(sendOtpEmail).mock.calls.length;

/** The raw OTP from the most recent (mocked) email. */
export function lastSentCode(): string {
  const calls = vi.mocked(sendOtpEmail).mock.calls;
  if (calls.length === 0) throw new Error("No OTP email was sent");
  return calls[calls.length - 1][1];
}

/** Registers a user and returns the OTP that was "emailed". */
export async function registerAndGetCode(email: string): Promise<string> {
  const res = await register(email);
  expect(res.status).toBe(201);
  return lastSentCode();
}

/** Any 6-digit code that differs from the real one. */
export const wrongCodeFor = (code: string) => (code === "000000" ? "111111" : "000000");

export async function latestOtp(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return prisma.otpVerification.findFirstOrThrow({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}

/** Makes the newest OTP already expired. */
export async function expireLatestOtp(email: string) {
  const otp = await latestOtp(email);
  await prisma.otpVerification.update({
    where: { id: otp.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
}

/** Pretends the newest OTP was created `seconds` ago (used to skip the resend cooldown). */
export async function ageLatestOtp(email: string, seconds: number) {
  const otp = await latestOtp(email);
  await prisma.otpVerification.update({
    where: { id: otp.id },
    data: { createdAt: new Date(Date.now() - seconds * 1000) },
  });
}

// ---- Direct DB user creation (skips the OTP flow) --------------------------

export async function createUser(email: string, opts: { verified: boolean }) {
  return prisma.user.create({
    data: {
      email,
      // Cost 4 instead of 12: tests don't need production-strength hashing.
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      emailVerified: opts.verified,
    },
  });
}