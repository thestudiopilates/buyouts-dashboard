import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

// Cache the client globally to prevent connection pool exhaustion
// in serverless environments (Vercel) where module-level state persists
// across warm invocations but global.__prisma may be undefined.
global.__prisma = prisma;
