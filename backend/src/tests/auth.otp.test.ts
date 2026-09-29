import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../config/prisma";
import {
  ageLatestOtp,
  emailsSent,
  expireLatestOtp,
  lastSentCode,
  latestOtp,
  register,
  registerAndGetCode,
  resend,
  resetDb,
  verify,
  wrongCodeFor,
} from "./helpers";

const EMAIL = "otp-user@example.com";

const isVerified = async () =>
  (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).emailVerified;

beforeEach(resetDb);

describe("OTP generation", () => {
  it("sends one 6-digit code by email and never returns it from the API", async () => {
    const res = await register(EMAIL);

    expect(res.status).toBe(201);
    expect(emailsSent()).toBe(1);

    const code = lastSentCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(res.body)).not.toContain(code);
  });

  it("stores only a hash, and the code expires in about 10 minutes", async () => {
    await register(EMAIL);
    const code = lastSentCode();
    const otp = await latestOtp(EMAIL);

    expect(otp.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(otp.codeHash).not.toBe(code);
    expect(otp.used).toBe(false);
    expect(otp.attempts).toBe(0);

    const minutesLeft = (otp.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutesLeft).toBeGreaterThan(9.5);
    expect(minutesLeft).toBeLessThanOrEqual(10);
  });

  it("verifies the email when the correct code is submitted", async () => {
    const code = await registerAndGetCode(EMAIL);

    const res = await verify(EMAIL, code);

    expect(res.status).toBe(200);
    expect(res.body.data.emailVerified).toBe(true);
    expect(await isVerified()).toBe(true);
  });

  it("rejects codes that are not exactly 6 digits", async () => {
    await registerAndGetCode(EMAIL);

    for (const bad of ["12345", "1234567", "12345a", ""]) {
      const res = await verify(EMAIL, bad);
      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe("VALIDATION_ERROR");
    }
  });
});

describe("OTP expiration", () => {
  it("rejects a correct code once it has expired", async () => {
    const code = await registerAndGetCode(EMAIL);
    await expireLatestOtp(EMAIL);

    const res = await verify(EMAIL, code);

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("OTP_EXPIRED");
    expect(await isVerified()).toBe(false);
  });
});

describe("OTP single use", () => {
  it("cannot be used a second time", async () => {
    const code = await registerAndGetCode(EMAIL);
    expect((await verify(EMAIL, code)).status).toBe(200);

    const otp = await latestOtp(EMAIL);
    expect(otp.used).toBe(true);

    // Un-verify the user directly in the DB, so the ONLY thing standing in the
    // way of a replay is the OTP's own single-use flag.
    await prisma.user.update({ where: { email: EMAIL }, data: { emailVerified: false } });

    const replay = await verify(EMAIL, code);
    expect(replay.status).toBe(400);
    expect(replay.body.errorCode).toBe("OTP_INVALID");
    expect(await isVerified()).toBe(false);
  });

  it("invalidates the older code when a new one is issued", async () => {
    const oldCode = await registerAndGetCode(EMAIL);
    await ageLatestOtp(EMAIL, 31); // skip the cooldown
    expect((await resend(EMAIL)).status).toBe(200);
    const newCode = lastSentCode();

    const withOld = await verify(EMAIL, oldCode);
    expect(withOld.status).toBe(400);
    expect(withOld.body.errorCode).toBe("OTP_INVALID");

    expect((await verify(EMAIL, newCode)).status).toBe(200);
  });
});

describe("OTP maximum wrong attempts", () => {
  it("blocks the 6th attempt, even with the correct code", async () => {
    const code = await registerAndGetCode(EMAIL);
    const wrong = wrongCodeFor(code);

    for (let i = 0; i < 5; i++) {
      const res = await verify(EMAIL, wrong);
      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe("OTP_INVALID");
    }

    const blocked = await verify(EMAIL, code);
    expect(blocked.status).toBe(429);
    expect(blocked.body.errorCode).toBe("OTP_MAX_ATTEMPTS");
    expect(await isVerified()).toBe(false);
  });

  it("still accepts the correct code on the 5th attempt", async () => {
    const code = await registerAndGetCode(EMAIL);

    for (let i = 0; i < 4; i++) {
      expect((await verify(EMAIL, wrongCodeFor(code))).status).toBe(400);
    }

    expect((await verify(EMAIL, code)).status).toBe(200);
  });

  it("lets the user recover by requesting a fresh code", async () => {
    const code = await registerAndGetCode(EMAIL);
    for (let i = 0; i < 6; i++) await verify(EMAIL, wrongCodeFor(code));

    await ageLatestOtp(EMAIL, 31);
    expect((await resend(EMAIL)).status).toBe(200);

    expect((await verify(EMAIL, lastSentCode())).status).toBe(200);
  });
});

describe("OTP resend cooldown", () => {
  it("rejects a resend inside the 30-second window and sends no email", async () => {
    await registerAndGetCode(EMAIL);

    const res = await resend(EMAIL);

    expect(res.status).toBe(429);
    expect(res.body.errorCode).toBe("OTP_RESEND_COOLDOWN");
    expect(emailsSent()).toBe(1);
  });

  it("allows a resend once the cooldown has passed", async () => {
    await registerAndGetCode(EMAIL);
    await ageLatestOtp(EMAIL, 31);

    const res = await resend(EMAIL);

    expect(res.status).toBe(200);
    expect(emailsSent()).toBe(2);
  });

  it("does not reveal whether an email is registered", async () => {
    const res = await resend("nobody@example.com");

    expect(res.status).toBe(200);
    expect(emailsSent()).toBe(0);
  });
});