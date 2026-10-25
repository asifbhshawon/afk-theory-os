import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionString =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "postgresql://postgres:postgres@localhost:5432/afk_business_os";

// Detect serverless environment (e.g. Vercel)
const isServerless =
  !!process.env.VERCEL ||
  process.env.IS_SERVERLESS === "true" ||
  process.env.NODE_ENV === "production";

// Supabase and cloud PostgreSQL require SSL
const requiresSsl =
  connectionString.includes("supabase.co") ||
  connectionString.includes("pooler.supabase.com") ||
  connectionString.includes("aws.connect.psdb.cloud") ||
  process.env.DB_SSL === "true";

function getSslConfiguration(): pg.ConnectionConfig["ssl"] {
  if (!requiresSsl) {
    return undefined;
  }

  // Non-production opt-out for development self-signed certs
  const allowInsecure =
    (process.env.DB_SSL_INSECURE === "true" || process.env.DB_SSL_REJECT_UNAUTHORIZED === "false") &&
    process.env.NODE_ENV !== "production";

  if (allowInsecure) {
    console.warn(
      "[Database TLS Warning] rejectUnauthorized=false is enabled for non-production development/test."
    );
    return { rejectUnauthorized: false };
  }

  // Strict TLS validation (default in production)
  const sslConfig: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized: true,
  };

  if (process.env.DB_CA_CERT) {
    sslConfig.ca = process.env.DB_CA_CERT;
  }

  return sslConfig;
}

const globalForDb = globalThis as unknown as {
  pool: pg.Pool | undefined;
};

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: isServerless ? 2 : 10,
    idleTimeoutMillis: isServerless ? 10000 : 30000,
    connectionTimeoutMillis: 10000,
    ssl: getSslConfiguration(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
