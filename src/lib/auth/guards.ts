import { getSessionTokenFromCookies, validateSession, SessionValidationResult, UserRole } from "./session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Retrieves the currently authenticated session without throwing an error if absent.
 */
export async function getOptionalAuth(): Promise<SessionValidationResult | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return null;
  }
  return await validateSession(token);
}

/**
 * Requires the current request to be authenticated with a valid server-side session.
 * Throws AuthError(401) if unauthenticated.
 */
export async function requireAuth(): Promise<SessionValidationResult> {
  const auth = await getOptionalAuth();
  if (!auth) {
    throw new AuthError("Unauthorized. Please log in.", 401);
  }
  return auth;
}

/**
 * Requires the current user to possess at least one of the specified roles.
 * Identity and roles are strictly derived from the database session lookup.
 * Throws AuthError(403) if unauthorized.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<SessionValidationResult> {
  const auth = await requireAuth();
  const hasRole = auth.roles.some((role) => allowedRoles.includes(role));

  if (!hasRole) {
    throw new AuthError("Forbidden. You do not have permission to access this resource.", 403);
  }

  return auth;
}

/**
 * Requires the current authenticated user to have a verified email address.
 * Throws AuthError(403) if email is unverified.
 */
export async function requireVerifiedEmail(): Promise<SessionValidationResult> {
  const auth = await requireAuth();

  if (!auth.user.emailVerified) {
    throw new AuthError("Email verification required. Please verify your email address to continue.", 403);
  }

  return auth;
}
