// Shared by vitest.config.ts and globalSetup.ts.
// Override with TEST_DATABASE_URL if your setup differs.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://padosipro:padosipro_dev@localhost:5432/padosipro_test?schema=public";