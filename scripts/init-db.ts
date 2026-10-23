import { db, pool } from "../src/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { initializeSystem, isSystemInitialized } from "../src/server/services/setup";
import { partners, users, accounts, roles } from "../src/db/schema";
import path from "path";

async function waitForDb(maxRetries = 30, delayMs = 1500) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log(`[DB] Connected to PostgreSQL successfully (attempt ${i}).`);
      return;
    } catch (err: any) {
      console.log(`[DB] Waiting for database (attempt ${i}/${maxRetries}): ${err.message}`);
      if (i === maxRetries) {
        throw new Error(`Could not connect to database after ${maxRetries} attempts.`);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function runInit() {
  console.log("=== AFK THEORY Business OS: Database Initialization ===");
  await waitForDb();

  const migrationsFolder =
    process.env.MIGRATIONS_FOLDER ||
    path.resolve(process.cwd(), "src/db/migrations");
  console.log(`[DB] Applying Drizzle migrations from: ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("[DB] Migrations applied successfully.");

  console.log("[DB] Checking system initialization status...");
  const initialized = await isSystemInitialized();
  if (!initialized) {
    console.log("[DB] System not initialized. Seeding initial accounts, roles, partners, venture types...");
    const defaultPartnerPasswords: Record<string, string> = {
      Shawon: process.env.INITIAL_ADMIN_PASSWORD || "Afk@Shawon2026!",
      Rafi: "Afk@Rafi2026!",
      Tousif: "Afk@Tousif2026!",
      Midhat: "Afk@Midhat2026!",
      Mueid: "Afk@Mueid2026!",
    };
    const initResult = await initializeSystem(defaultPartnerPasswords);
    if (initResult.credentials && initResult.credentials.length > 0) {
      console.log("\n=======================================================");
      console.log("  NEW PARTNER CREDENTIALS GENERATED (FIRST-RUN SETUP)");
      console.log("  Store these credentials securely in your password manager!");
      console.log("=======================================================");
      initResult.credentials.forEach((c) => {
        console.log(`Partner: ${c.name.padEnd(8)} | Email: ${c.email.padEnd(25)} | Temp Password: ${c.temporaryPassword}`);
      });
      console.log("=======================================================\n");
    }
    console.log("[DB] First-run seeding completed successfully.");
  } else {
    console.log("[DB] System is already initialized. Preserving existing data.");
  }

  const allPartners = await db.select().from(partners);
  const allUsers = await db.select().from(users);
  const allAccounts = await db.select().from(accounts);
  const allRoles = await db.select().from(roles);
  console.log(`[DB] Status: ${allPartners.length} partners registered, ${allUsers.length} user accounts active.`);
  console.log(`[DB] Status: ${allAccounts.length} GL accounts, ${allRoles.length} RBAC roles loaded.`);
  console.log("=== AFK THEORY Business OS: Ready ===");
}

if (require.main === module) {
  runInit()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error("[DB] Initialization failed:", err);
      process.exit(1);
    });
}
