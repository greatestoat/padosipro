import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// In development, `tsx watch` reloads modules on every save. Without this
// global cache, each reload would open a new connection pool and eventually
// exhaust Postgres connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}