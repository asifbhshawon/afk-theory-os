import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/sync/portal/route";
import { getCloudSyncStatus } from "@/server/services/cloud-sync";

describe("Acceptance Suite 22: Local ERP Easy Syncing Button & API", () => {
  it("Requirement 1: Provides GET /api/sync/portal for sync status polling", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toBeDefined();
    expect(typeof data.isConfigured).toBe("boolean");
    expect(data.isConfigured).toBe(true);
    expect(typeof data.isLive).toBe("boolean");
  });

  it("Requirement 2: Protects POST /api/sync/portal with 401 for unauthenticated calls", async () => {
    const res = await POST();
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/Unauthorized/);
  });

  it("Requirement 3: Verifies getCloudSyncStatus returns Supabase singleton metadata", async () => {
    const status = await getCloudSyncStatus();
    expect(status.isConfigured).toBe(true);
    expect(status.lastPushedAt).toBeDefined();
    expect(status.lastPushStatus).toBe("SUCCESS");
  });
});
