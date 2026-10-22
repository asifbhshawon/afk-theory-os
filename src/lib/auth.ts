import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { users, sessions, userRoles, roles, auditLogs } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "afk_session_id";
export const SESSION_TTL_HOURS = 24 * 7; // 7 days

// Generate cryptographically secure random password
export function generateSecurePassword(length: number = 16): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// Hash a password using scrypt (standard Node.js crypto, memory-hard, offline)
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

// Verify password against stored hash with timing safe check
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

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  isAdmin: boolean;
}

// Get current active session & user details from Next.js cookies
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
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
  } catch {
    return null;
  }
}

// Enforce authentication on server actions and API routes
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized: Please log in to access this feature.");
  }
  return user;
}

// Enforce role-based access control
export async function requireRole(requiredRoleOrRoles: string | string[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.isAdmin) {
    return user; // ADMIN has superuser privileges across all modules
  }

  const allowed = Array.isArray(requiredRoleOrRoles) ? requiredRoleOrRoles : [requiredRoleOrRoles];
  const hasMatchingRole = user.roles.some((r) => allowed.includes(r));

  if (!hasMatchingRole) {
    throw new Error(
      `Forbidden: Your role (${user.roles.join(", ")}) does not have permission for this action. Required: ${allowed.join(" or ")}.`
    );
  }

  return user;
}

// Check role permission without throwing
export function hasRole(userRolesList: string[], requiredRole: string): boolean {
  if (userRolesList.includes("ADMIN")) return true;
  return userRolesList.includes(requiredRole);
}

// Authenticate user with email and password, establishing secure session cookie
export async function loginUser(email: string, password: string): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  if (!user) {
    return { success: false, error: "Invalid email or password." };
  }

  if (user.status === "SUSPENDED") {
    return { success: false, error: "This account has been suspended. Please contact an administrator." };
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Invalid email or password." };
  }

  const { token, expiresAt } = await createSession(user.id);

  // Set HTTP-only secure session cookie
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_HTTP !== "true",
    expires: expiresAt,
    path: "/",
  });

  // Log successful login
  try {
    await db.insert(auditLogs).values({
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "USER",
      entityId: user.id,
      details: `User ${user.name} (${user.email}) logged in successfully.`,
    });
  } catch {
    // Ignore audit log failure during login
  }

  // Get roles
  const userRoleRows = await db
    .select({ roleCode: userRoles.roleCode })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));
  const roleCodes = userRoleRows.map((r) => r.roleCode);

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: roleCodes,
      isAdmin: roleCodes.includes("ADMIN"),
    },
  };
}

// Invalidate session and clear session cookie
export async function logoutUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    await db.delete(sessions).where(eq(sessions.id, sessionToken));
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

// Change password
export async function changePassword(
  userId: string,
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  if (newPass.length < 8) {
    return { success: false, error: "New password must be at least 8 characters long." };
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return { success: false, error: "User not found." };
  }

  if (!verifyPassword(currentPass, user.passwordHash)) {
    return { success: false, error: "Current password is incorrect." };
  }

  const newHash = hashPassword(newPass);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    userId,
    action: "CHANGE_PASSWORD",
    entityType: "USER",
    entityId: userId,
    details: `Password changed for user ${user.name}.`,
  });

  return { success: true };
}
