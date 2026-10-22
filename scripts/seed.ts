import { initializeSystem, isSystemInitialized } from "../src/server/services/setup";
import { db } from "../src/db";
import { partners, users, accounts, roles } from "../src/db/schema";

async function main() {
  console.log("Checking system status...");
  const initialized = await isSystemInitialized();
  console.log(`System initialized: ${initialized}`);

  console.log("Running initialization and partner provisioning...");
  const initResult = await initializeSystem();

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

  const allRoles = await db.select().from(roles);
  const allAccounts = await db.select().from(accounts);
  const allPartners = await db.select().from(partners);
  const allUsers = await db.select().from(users);

  console.log(`Roles created: ${allRoles.length}`);
  console.log(`Accounts created: ${allAccounts.length}`);
  console.log(`Partners created: ${allPartners.length}`);
  allPartners.forEach((p) => {
    console.log(`- Partner ${p.name}: Ownership ${p.ownershipPct}%, Profit Share ${p.profitSharePct}%`);
  });
  console.log(`Users created: ${allUsers.length}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
