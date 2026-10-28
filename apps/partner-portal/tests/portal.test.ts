import { describe, it, expect, beforeAll } from "vitest";
import {
  INITIAL_FOUNDING_PARTNERS,
  PortalPartner,
} from "../lib/constants";
import {
  hashPassword,
  verifyPassword,
  hasVentureAccess,
  ensurePortalPartnersInitialized,
  createPartnerSession,
  getPartnerInitialPassword,
} from "../lib/auth";
import {
  formatBdt,
  formatCompactBdt,
  toBengaliDigits,
  formatDate,
  formatRelativeSyncTime,
} from "../lib/format";
import { ensurePortalTablesExist } from "../lib/migrate";

describe("AFK Partner Portal Unit Tests", () => {
  beforeAll(async () => {
    await ensurePortalTablesExist();
    await ensurePortalPartnersInitialized();
  });

  it("1. Verifies 5 founding partner credentials and password hashes", () => {
    expect(INITIAL_FOUNDING_PARTNERS.length).toBe(5);
    const names = INITIAL_FOUNDING_PARTNERS.map((p) => p.name);
    expect(names).toEqual(["Shawon", "Rafi", "Tousif", "Midhat", "Mueid"]);

    for (const p of INITIAL_FOUNDING_PARTNERS) {
      const pass = getPartnerInitialPassword(p.id) || "AFK-Secure-Key-2026";
      const hash = hashPassword(pass);
      expect(verifyPassword(pass, hash)).toBe(true);
      expect(verifyPassword("invalid", hash)).toBe(false);
    }
  });

  it("2. Verifies venture permission scoping rules", () => {
    const tousif: PortalPartner = {
      id: "partner-tousif",
      name: "Tousif",
      email: "tousif@afktheory.com",
      role: "PARTNER",
      isActive: true,
      permittedVentureIds: ["VENT-2026-0001"],
    };

    expect(hasVentureAccess(tousif, "VENT-2026-0001")).toBe(true);
    expect(hasVentureAccess(tousif, "VENT-2026-0002")).toBe(false);

    const shawon: PortalPartner = {
      id: "partner-shawon",
      name: "Shawon",
      email: "shawon@afktheory.com",
      role: "ADMIN",
      isActive: true,
      permittedVentureIds: ["*"],
    };

    expect(hasVentureAccess(shawon, "VENT-2026-0001")).toBe(true);
    expect(hasVentureAccess(shawon, "VENT-2026-0002")).toBe(true);
    expect(hasVentureAccess(shawon, "ANY-RANDOM-VENTURE")).toBe(true);
  });

  it("3. Verifies BDT and Bengali currency/date formatting", () => {
    expect(formatBdt(250000)).toBe("৳250,000.00");
    expect(formatCompactBdt(10000000)).toBe("৳1.00 Cr");
    expect(formatCompactBdt(500000)).toBe("৳5.00 L");
    expect(toBengaliDigits(2026)).toBe("২০২৬");
    expect(formatRelativeSyncTime(null)).toBe("Never synced");
    expect(formatRelativeSyncTime(new Date())).toBe("Just now");
  });

  it("4. Creates secure session token", async () => {
    const session = await createPartnerSession("partner-shawon");
    expect(session.token).toBeDefined();
    expect(session.token.length).toBe(64);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
