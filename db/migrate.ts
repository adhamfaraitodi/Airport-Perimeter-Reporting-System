import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required for migrations.");
  }

  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log(`[migrate] Applying Drizzle migrations from ${migrationsFolder}...`);
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] Migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
});
