import crypto from "crypto";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, userRoles, roleEnum } from "@/db/schema";

export const SESSION_COOKIE_NAME = "buildmate_session";
export const SESSION_EXPIRY_DAYS = 7;

export type UserRole = (typeof roleEnum.enumValues)[number];

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionValidationResult = {
  user: SafeUser;
  roles: UserRole[];
};

/**
 * Computes a deterministic SHA-256 hash of a raw token.
 * Tokens are only stored as hashes in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates an opaque, cryptographically random server session token
 * and stores its SHA-256 hash in the database.
 * 
 * @param userId The ID of the authenticated user
 * @returns The raw opaque token to be sent only in the HttpOnly cookie
 */
export async function createSession(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { rawToken, expiresAt };
}

/**
 * Validates a session by hashing the raw token from the cookie
 * and performing a server-side database lookup.
 * 
 * Never trusts client claims. All user details and roles are fetched fresh from DB.
 */
export async function validateSession(rawToken: string): Promise<SessionValidationResult | null> {
  if (!rawToken || typeof rawToken !== "string") {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  // 1. Look up active session
  const [sessionRow] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!sessionRow) {
    return null;
  }

  // 2. Look up associated user
  const [userRow] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, sessionRow.userId))
    .limit(1);

  if (!userRow) {
    return null;
  }

  // 3. Look up user roles
  const roleRows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userRow.id));

  const roles = roleRows.map((r) => r.role as UserRole);

  return {
    user: userRow,
    roles,
  };
}

/**
 * Invalidates (revokes) a session by deleting it from the database.
 */
export async function invalidateSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/**
 * Sets the HttpOnly session cookie on the outgoing response.
 * 
 * Security rules:
 * - HttpOnly: true (inaccessible to client JavaScript)
 * - SameSite: "lax" (mitigates CSRF)
 * - Secure: true only in production
 * - Path: "/"
 * - Contains ZERO user claims or identity data (only the random opaque token)
 */
export async function setSessionCookie(rawToken: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Clears the session cookie from the client.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Helper to retrieve the current session token from request cookies.
 */
export async function getSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  return cookie?.value || null;
}
