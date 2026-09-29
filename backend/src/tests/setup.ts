import { afterAll, vi } from "vitest";
import { prisma } from "../config/prisma";

// Applies to every test file. The real mailer is never used in tests.
// The tests read the OTP from this mock's arguments.
vi.mock("../services/mail.service", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

// Safety net: tests delete users, so they must never point at the dev database.
if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error("Tests must run against a database whose URL contains '_test'");
}

afterAll(async () => {
  await prisma.$disconnect();
});