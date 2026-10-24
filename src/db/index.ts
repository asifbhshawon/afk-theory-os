import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "postgresql://postgres:postgres@localhost:5432/afk_business_os";

// Detect if running in a serverless environment (e.g. Vercel)
const isServerless =
  !!process.env.VERCEL ||
  process.env.IS_SERVERLESS === "true";

// Supabase and cloud PostgreSQL require SSL
const requiresSsl =
  connectionString.includes("supabase.co") ||
  connectionString.includes("pooler.supabase.com") ||
  connectionString.includes("aws.connect.psdb.cloud") ||
  process.env.DB_SSL === "true";

// Prevent multiple pools in development hot reloading
const globalForDb = globalThis as unknown as {
  pool: pg.Pool | undefined;
};

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: isServerless ? 2 : 20,
    idleTimeoutMillis: isServerless ? 10000 : 30000,
    connectionTimeoutMillis: 10000,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
