import { beforeEach, describe, expect, it } from "vitest";
import {
  PASSWORD,
  api,
  createUser,
  login,
  registerAndGetCode,
  resetDb,
  verify,
} from "./helpers";

beforeEach(resetDb);

describe("login: verified user", () => {
  it("returns a JWT with an expiry, and the token works on protected routes", async () => {
    await createUser("verified@example.com", { verified: true });

    const res = await login("verified@example.com");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.expiresIn).toBe(3600);
    expect(res.body.data.user).toMatchObject({
      email: "verified@example.com",
      profileCompleted: false,
      hasSelectedTasks: false,
    });

    const profile = await api()
      .get("/api/profile")
      .set("Authorization", `Bearer ${res.body.data.token}`);
    expect(profile.status).toBe(200);
  });

  it("treats the email case-insensitively", async () => {
    await createUser("verified@example.com", { verified: true });

    expect((await login("VERIFIED@Example.com")).status).toBe(200);
  });
});

describe("login: unverified user", () => {
  it("is rejected with EMAIL_NOT_VERIFIED and receives no token", async () => {
    await createUser("unverified@example.com", { verified: false });

    const res = await login("unverified@example.com");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe("EMAIL_NOT_VERIFIED");
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("token");
  });

  it("gets INVALID_CREDENTIALS, not EMAIL_NOT_VERIFIED, with a wrong password", async () => {
    await createUser("unverified@example.com", { verified: false });

    const res = await login("unverified@example.com", "WrongPass1");

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe("INVALID_CREDENTIALS");
  });
});

describe("login: incorrect credentials", () => {
  it("rejects an incorrect password", async () => {
    await createUser("verified@example.com", { verified: true });

    const res = await login("verified@example.com", "WrongPass1");

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe("INVALID_CREDENTIALS");
    expect(JSON.stringify(res.body)).not.toContain("token");
  });

  it("gives an unknown email the exact same response as a wrong password", async () => {
    await createUser("verified@example.com", { verified: true });

    const wrongPassword = await login("verified@example.com", "WrongPass1");
    const unknownEmail = await login("nobody@example.com", PASSWORD);

    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe("full flow", () => {
  it("register → verify OTP → login", async () => {
    const email = "flow@example.com";
    const code = await registerAndGetCode(email);

    // Before verifying, login is blocked.
    expect((await login(email)).status).toBe(403);

    expect((await verify(email, code)).status).toBe(200);

    const res = await login(email);
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
  });
});