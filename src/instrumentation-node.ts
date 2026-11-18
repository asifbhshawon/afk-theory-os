import { resumePendingPortalSync } from "@/server/services/portal-autosync";

// If the ERP stopped with Partner Portal changes still pending (or the cloud was
// unreachable), push them shortly after start-up. Never blocks or crashes boot.
resumePendingPortalSync().catch((err) => {
  console.error("[portal-sync] could not resume pending sync:", err?.message ?? err);
});
