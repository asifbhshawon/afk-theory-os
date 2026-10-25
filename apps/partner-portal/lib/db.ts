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

  // If a custom CA certificate is provided, validate strictly against it
  if (process.env.DB_CA_CERT) {
    return {
      rejectUnauthorized: true,
      ca: process.env.DB_CA_CERT,
    };
  }

  // If strict validation is explicitly required by the operator
  if (process.env.DB_SSL_REJECT_UNAUTHORIZED === "true") {
    return { rejectUnauthorized: true };
  }

  // Supabase session pooler and cloud hosts use internal intermediate certificates.
  // Using rejectUnauthorized: false maintains active SSL/TLS wire encryption
  // without failing on Node's default root store (preventing SELF_SIGNED_CERT_IN_CHAIN).
  return { rejectUnauthorized: false };
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
