import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { db } from "./db";
import { portalPartners, portalSessions } from "./schema";
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { ensurePortalTablesExist } from "./migrate";
import {
  PARTNER_SESSION_COOKIE,
  SESSION_TTL_HOURS,
  INITIAL_FOUNDING_PARTNERS,
  PortalPartner,
  FoundingPartnerConfig,
} from "./constants";

export {
  PARTNER_SESSION_COOKIE,
  SESSION_TTL_HOURS,
  INITIAL_FOUNDING_PARTNERS,
  type PortalPartner,
  type FoundingPartnerConfig,
};

// Blacklist of previously exposed default credentials that must NEVER be accepted
export const LEAKED_EXPOSED_PASSWORDS = new Set([
  "AFK-Shawon-Executive-2026!",
  "AFK-Rafi-Partner-2026!",
  "AFK-Tousif-Partner-2026!",
  "AFK-Midhat-Partner-2026!",
  "AFK-Mueid-Partner-2026!",
]);

// Rotated default initial credentials (replacing the leaked 2026! credentials)
export const ROTATED_DEFAULT_PASSWORDS: Record<string, string> = {
  "partner-shawon": "AFK-Shawon-2026#ExecutiveKey",
  "partner-rafi": "AFK-Rafi-2026#PartnerKey",
  "partner-tousif": "AFK-Tousif-2026#PartnerKey",
  "partner-midhat": "AFK-Midhat-2026#PartnerKey",
  "partner-mueid": "AFK-Mueid-2026#PartnerKey",
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, key] = combinedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Resolves the configured initial password for a partner from environment variables
 * or secure rotated defaults.
 */
export function getPartnerInitialPassword(partnerId: string): string | null {
  const suffix = partnerId.replace("partner-", "").toUpperCase();

  // 1. Check partner-specific environment variable
  const directEnv =
    process.env[`PARTNER_PASSWORD_${suffix}`] ||
    process.env[`PARTNER_${suffix}_PASSWORD`];
  if (directEnv) {
    if (LEAKED_EXPOSED_PASSWORDS.has(directEnv)) {
      throw new Error(
        `Security Error: Environment variable for ${partnerId} contains a retired exposed credential. Please provide a new secret.`
      );
    }
    return directEnv;
  }

  // 2. Check JSON dictionary environment variable
  if (process.env.INITIAL_PARTNER_PASSWORDS_JSON) {
    try {
      const map = JSON.parse(process.env.INITIAL_PARTNER_PASSWORDS_JSON);
      if (map[partnerId]) {
        if (LEAKED_EXPOSED_PASSWORDS.has(map[partnerId])) {
          throw new Error(
            `Security Error: INITIAL_PARTNER_PASSWORDS_JSON for ${partnerId} contains a retired exposed credential.`
          );
        }
        return map[partnerId];
      }
    } catch (e: any) {
      console.error("[Auth] Failed to parse INITIAL_PARTNER_PASSWORDS_JSON", e);
    }
  }

  // 3. For automated unit & acceptance tests (Vitest)
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return `AFK-Test-Secure-${suffix}-2026#SecureTestKey`;
  }

  // 4. Default rotated initial credentials
  return ROTATED_DEFAULT_PASSWORDS[partnerId] || null;
}

let partnersInitialized = false;

export async function ensurePortalPartnersInitialized() {
  if (partnersInitialized) return;
  try {
    await ensurePortalTablesExist();

    for (const p of INITIAL_FOUNDING_PARTNERS) {
      const [existing] = await db
        .select()
        .from(portalPartners)
        .where(eq(portalPartners.id, p.id))
        .limit(1);

      if (!existing) {
        // Resolve initial password or fallback to random token
        const configuredPass = getPartnerInitialPassword(p.id);
        const passwordToHash = configuredPass || randomBytes(32).toString("hex");

        await db.insert(portalPartners).values({
          id: p.id,
          name: p.name,
          email: p.email,
          passwordHash: hashPassword(passwordToHash),
          role: p.role,
          isActive: true,
          permittedVentureIds: p.permittedVentureIds,
        });

        if (!configuredPass) {
          console.warn(
            `[Auth Onboarding] Partner ${p.email} provisioned without credentials. Requires password setup.`
          );
        }
      } else {
        // Credential Rotation Enforcement:
        // If the database has an existing password that matches any retired leaked password, rotate it immediately.
        for (const leaked of LEAKED_EXPOSED_PASSWORDS) {
          if (verifyPassword(leaked, existing.passwordHash)) {
            console.warn(`[Security Alert] Leaked credential detected for partner ${p.id}. Rotating...`);
            const rotatedPassword = getPartnerInitialPassword(p.id);
            const replacementHash = hashPassword(rotatedPassword || randomBytes(32).toString("hex"));

            await db
              .update(portalPartners)
              .set({ passwordHash: replacementHash })
              .where(eq(portalPartners.id, p.id));

            console.log(`[Security OK] Successfully rotated compromised credentials for ${p.id}.`);
            break;
          }
        }
      }
    }
    partnersInitialized = true;
  } catch (err: any) {
    console.error("[Auth] Error in ensurePortalPartnersInitialized:", err);
    throw err;
  }
}

export async function createPartnerSession(
  partnerId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.insert(portalSessions).values({
    id: token,
    partnerId,
    expiresAt,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });

  return { token, expiresAt };
}

export async function revokePartnerSession(token: string) {
  await db.delete(portalSessions).where(eq(portalSessions.id, token));
}

export async function getCurrentPartner(): Promise<PortalPartner | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PARTNER_SESSION_COOKIE)?.value;
    if (!token) return null;

    const now = new Date();
    const [session] = await db
      .select()
      .from(portalSessions)
      .where(and(eq(portalSessions.id, token), gt(portalSessions.expiresAt, now)))
      .limit(1);

    if (!session) return null;

    const [partner] = await db
      .select()
      .from(portalPartners)
      .where(eq(portalPartners.id, session.partnerId))
      .limit(1);

    if (!partner || !partner.isActive) return null;

    const permitted = Array.isArray(partner.permittedVentureIds)
      ? (partner.permittedVentureIds as string[])
      : [];

    return {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      role: partner.role,
      isActive: partner.isActive,
      permittedVentureIds: permitted,
      avatarUrl: partner.avatarUrl,
    };
  } catch {
    return null;
  }
}

export function hasVentureAccess(partner: PortalPartner, ventureIdOrNumber: string): boolean {
  if (partner.role === "ADMIN") return true;
  if (partner.permittedVentureIds.includes("*")) return true;
  return partner.permittedVentureIds.includes(ventureIdOrNumber);
}
