import { syncLocalErpToCloud } from "../src/server/services/cloud-sync";

async function main() {
  console.log("==========================================================");
  console.log("   AFK THEORY — Local ERP to Supabase Cloud Sync");
  console.log("==========================================================");

  try {
    const result = await syncLocalErpToCloud();
    console.log("\n[SUCCESS] Exact local Business OS ERP state pushed to Supabase Cloud!");
    console.log("Timestamp:", result.timestamp);
    console.log("Counts:", result.counts);
    console.log("Summary:", result.summary);
    console.log("==========================================================");
  } catch (err) {
    console.error("\n[ERROR] Sync failed:", err);
    process.exit(1);
  }
}

main();
