import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./testConfig";

// Runs once before all test files: brings the test DB up to the latest migration.
export default function setup() {
  if (!TEST_DATABASE_URL.includes("_test")) {
    throw new Error("Refusing to run: the test database URL must contain '_test'");
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}