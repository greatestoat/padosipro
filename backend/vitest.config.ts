import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./src/tests/testConfig";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    globalSetup: ["./src/tests/globalSetup.ts"],
    setupFiles: ["./src/tests/setup.ts"],
    fileParallelism: false, // all files share one database
    clearMocks: true, // reset mock call history before every test
    testTimeout: 20_000, // bcrypt (12 rounds) is deliberately slow
    hookTimeout: 60_000,
    env: {
      // These win over backend/.env, because dotenv never overrides existing vars.
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "test-only-jwt-secret-0123456789-abcdefghijklmnop",
      JWT_EXPIRES_IN: "1h",
      OTP_HMAC_SECRET: "test-only-otp-secret-0123456789-abcdefghijklmnop",
      OTP_TTL_MINUTES: "10",
      OTP_MAX_ATTEMPTS: "5",
      OTP_RESEND_COOLDOWN_SECONDS: "30",
    },
  },
});