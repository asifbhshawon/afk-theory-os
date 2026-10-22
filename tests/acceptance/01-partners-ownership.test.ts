import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { partners, users, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Acceptance Test 1: Partner Ownership & Role Independence", () => {
  it("should have exactly five founding partners, each with exactly 20.00% initial ownership", async () => {
    const partnerList = await db.select().from(partners);
    expect(partnerList).toHaveLength(5);

    const partnerNames = partnerList.map((p) => p.name).sort();
    expect(partnerNames).toEqual(["Midhat", "Mueid", "Rafi", "Shawon", "Tousif"]);

    partnerList.forEach((p) => {
      expect(Number(p.ownershipPct)).toBe(20.0);
      expect(Number(p.profitSharePct)).toBe(20.0);
    });

    const totalOwnership = partnerList.reduce((sum, p) => sum + Number(p.ownershipPct), 0);
    expect(totalOwnership).toBe(100.0);
  });

  it("changing a user's operational role must not alter their equity ownership", async () => {
    // Find Shawon
    const [shawon] = await db.select().from(partners).where(eq(partners.name, "Shawon")).limit(1);
    expect(shawon).toBeDefined();
    expect(Number(shawon.ownershipPct)).toBe(20.0);

    const [shawonUser] = await db.select().from(users).where(eq(users.id, shawon.userId!)).limit(1);
    expect(shawonUser).toBeDefined();

    // Give Shawon an extra role or remove a role
    await db.insert(userRoles).values({
      userId: shawonUser.id,
      roleCode: "INVENTORY_MGR",
    }).onConflictDoNothing();

    // Re-query partner
    const [updatedShawon] = await db.select().from(partners).where(eq(partners.name, "Shawon")).limit(1);
    expect(Number(updatedShawon.ownershipPct)).toBe(20.0);
    expect(Number(updatedShawon.profitSharePct)).toBe(20.0);
  });
});
