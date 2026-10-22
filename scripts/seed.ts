import { initializeSystem, isSystemInitialized } from "../src/server/services/setup";
import { db } from "../src/db";
import { partners, users, accounts, roles } from "../src/db/schema";

async function main() {
  console.log("Checking system status...");
  const initialized = await isSystemInitialized();
  console.log(`System initialized: ${initialized}`);

  console.log("Running initialization and partner provisioning...");
  await initializeSystem();

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
