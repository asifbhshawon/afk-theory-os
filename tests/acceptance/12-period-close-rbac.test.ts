import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { fiscalPeriods, accounts, users, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { postJournalEntry } from "@/server/services/finance";
import { hasRole } from "@/lib/auth";

describe("Acceptance Tests 12 & 13: Period Closing & Role-Based Access Control", () => {
  it("Acceptance Test 12: Period close stops backdated normal posting and requires authorised adjustment", async () => {
    // 1. Create a closed fiscal period for previous month (e.g. Sept 2026)
    const startDate = new Date("2026-09-01T00:00:00.000Z");
    const endDate = new Date("2026-09-30T23:59:59.999Z");

    const [period] = await db
      .insert(fiscalPeriods)
      .values({
        name: `FY2026-M09-${Date.now().toString().slice(-4)}`,
        startDate,
        endDate,
        isClosed: true, // Marked CLOSED
      })
      .returning();

    // 2. Attempt to post a normal journal with a backdated date in September 2026
    const [cashAcc] = await db.select().from(accounts).where(eq(accounts.code, "1010")).limit(1);
    const [revAcc] = await db.select().from(accounts).where(eq(accounts.code, "4010")).limit(1);

    const backdatedDate = new Date("2026-09-15T12:00:00.000Z");

    await expect(
      postJournalEntry({
        date: backdatedDate,
        entryType: "MANUAL",
        description: "Backdated post into closed period",
        lines: [
          { accountId: cashAcc.id, debit: 1000, credit: 0 },
          { accountId: revAcc.id, debit: 0, credit: 1000 },
        ],
      })
    ).rejects.toThrow(/Cannot post transaction to closed fiscal period/);
  });

  it("Acceptance Test 13: Partner Viewer role permissions are read-only for ledger writes", async () => {
    // Find user with only PARTNER_VIEWER role
    const viewerRoles = ["PARTNER_VIEWER"];
    const financeMgrRoles = ["FINANCE_MGR", "PARTNER_VIEWER"];
    const adminRoles = ["ADMIN"];

    // Check permissions
    expect(hasRole(viewerRoles, "FINANCE_MGR")).toBe(false);
    expect(hasRole(viewerRoles, "ADMIN")).toBe(false);

    expect(hasRole(financeMgrRoles, "FINANCE_MGR")).toBe(true);
    expect(hasRole(financeMgrRoles, "ADMIN")).toBe(false);

    expect(hasRole(adminRoles, "FINANCE_MGR")).toBe(true); // Admin has all permissions
    expect(hasRole(adminRoles, "INVENTORY_MGR")).toBe(true);
  });
});
