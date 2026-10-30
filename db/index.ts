import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres@127.0.0.1:5432/postgres";

// Singleton pool for Next.js hot-reloading in development (recreates pool if URL changes)
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  poolUrl: string | undefined;
};

if (globalForDb.pool && globalForDb.poolUrl !== connectionString) {
  globalForDb.pool.end().catch(() => null);
  globalForDb.pool = undefined;
}

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
  globalForDb.poolUrl = connectionString;
}

export const db = drizzle(pool, { schema });
export { schema };
export * from "./schema";
