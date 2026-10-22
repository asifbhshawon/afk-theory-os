import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { users, sessions, userRoles, roles } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "afk_session_id";
const SESSION_TTL_HOURS = 24 * 7; // 7 days

// Hash a password using scrypt (standard Node.js crypto, memory-hard, offline)
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

// Verify password against stored hash
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

// Create user session and return session token
export async function createSession(userId: string, ipAddress?: string, userAgent?: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });

  return { token, expiresAt };
}

// Get current active session & user details from Next.js cookies
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const now = new Date();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionToken), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) {
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || user.status === "SUSPENDED") {
    return null;
  }

  // Fetch user roles
  const userRoleRows = await db
    .select({
      roleCode: userRoles.roleCode,
    })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));

  const roleCodes = userRoleRows.map((r) => r.roleCode);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    roles: roleCodes,
    isAdmin: roleCodes.includes("ADMIN"),
  };
}

// Check role permission
export function hasRole(userRolesList: string[], requiredRole: string): boolean {
  if (userRolesList.includes("ADMIN")) return true; // ADMIN has all roles
  return userRolesList.includes(requiredRole);
}

// Invalidate session
export async function destroySession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    await db.delete(sessions).where(eq(sessions.id, sessionToken));
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}
