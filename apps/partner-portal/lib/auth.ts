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
} from "./constants";

export {
  PARTNER_SESSION_COOKIE,
  SESSION_TTL_HOURS,
  INITIAL_FOUNDING_PARTNERS,
  type PortalPartner,
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
        await db.insert(portalPartners).values({
          id: p.id,
          name: p.name,
          email: p.email,
          passwordHash: hashPassword(p.initialPassword),
          role: p.role,
          isActive: true,
          permittedVentureIds: p.permittedVentureIds,
        });
      }
    }
    partnersInitialized = true;
  } catch (err) {
    console.warn("Notice: ensurePortalPartnersInitialized deferred or running offline", err);
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
