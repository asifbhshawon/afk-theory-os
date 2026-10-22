import { describe, it, expect, vi } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSecurePassword,
  requireAuth,
  requireRole,
  hasRole,
  changePassword,
} from "@/lib/auth";
import { POST as backupApiPost } from "@/app/api/backup/route";

describe("Negative Security & RBAC Access Control Tests", () => {
  it("rejects unauthenticated calls when no session is present", async () => {
    // Calling requireAuth with no active cookie session should throw Unauthorized
    await expect(requireAuth()).rejects.toThrow(/Unauthorized/);
  });

  it("enforces role-based authorization: non-admin roles cannot access unauthorized modules", () => {
    const salesOperatorRoles = ["SALES_OP", "PARTNER_VIEWER"];
    const inventoryMgrRoles = ["INVENTORY_MGR", "PARTNER_VIEWER"];
    const adminRoles = ["ADMIN", "FINANCE_MGR"];

    // Sales Op should NOT have access to FINANCE_MGR or ADMIN
    expect(hasRole(salesOperatorRoles, "FINANCE_MGR")).toBe(false);
    expect(hasRole(salesOperatorRoles, "ADMIN")).toBe(false);
    expect(hasRole(salesOperatorRoles, "SALES_OP")).toBe(true);

    // Inventory Manager should NOT have access to FINANCE_APPROVER or ADMIN
    expect(hasRole(inventoryMgrRoles, "FINANCE_APPROVER")).toBe(false);
    expect(hasRole(inventoryMgrRoles, "INVENTORY_MGR")).toBe(true);

    // ADMIN has universal permission
    expect(hasRole(adminRoles, "ADMIN")).toBe(true);
    expect(hasRole(adminRoles, "FINANCE_MGR")).toBe(true);
    expect(hasRole(adminRoles, "SALES_OP")).toBe(true);
  });

  it("cryptographic password hashing and timing-safe verification rejects tampering", () => {
    const rawPassword = "CorrectHorseBatteryStaple2026!";
    const hash = hashPassword(rawPassword);

    // Verification must pass with exact password
    expect(verifyPassword(rawPassword, hash)).toBe(true);

    // Verification must fail with incorrect password
    expect(verifyPassword("WrongPassword123!", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);

    // Verification must fail with malformed hash
    expect(verifyPassword(rawPassword, "invalid-hash-string")).toBe(false);
    expect(verifyPassword(rawPassword, "salt-only:")).toBe(false);
  });

  it("generateSecurePassword generates high-entropy unique strings", () => {
    const pwd1 = generateSecurePassword(16);
    const pwd2 = generateSecurePassword(16);

    expect(pwd1.length).toBe(16);
    expect(pwd2.length).toBe(16);
    expect(pwd1).not.toBe(pwd2);
    // Should contain a mixture of characters
    expect(/[a-zA-Z]/.test(pwd1)).toBe(true);
    expect(/[0-9!@#$%&*]/.test(pwd1)).toBe(true);
  });

  it("protects API endpoint /api/backup against unauthenticated execution", async () => {
    const response = await backupApiPost();
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Unauthorized/);
  });
});
