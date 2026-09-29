import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateOtp, hashOtp, otpMatches } from "../utils/otp";

describe("OTP generation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("always produces exactly 6 digits", () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("keeps leading zeros", () => {
    vi.spyOn(crypto, "randomInt").mockReturnValue(42 as never);
    expect(generateOtp()).toBe("000042");
  });
});

describe("OTP hashing", () => {
  it("is deterministic, hex-encoded, and never equals the raw code", () => {
    const hash = hashOtp("user-1", "123456");
    expect(hash).toBe(hashOtp("user-1", "123456"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe("123456");
  });

  it("is bound to the user, so the same code hashes differently per user", () => {
    expect(hashOtp("user-1", "123456")).not.toBe(hashOtp("user-2", "123456"));
  });

  it("otpMatches accepts the right code and rejects everything else", () => {
    const stored = hashOtp("user-1", "123456");
    expect(otpMatches("user-1", "123456", stored)).toBe(true);
    expect(otpMatches("user-1", "654321", stored)).toBe(false);
    expect(otpMatches("user-2", "123456", stored)).toBe(false);
    expect(otpMatches("user-1", "123456", "not-hex")).toBe(false);
  });
});