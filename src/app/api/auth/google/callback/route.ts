import { NextResponse } from "next/server";
import { eq, or, and } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { exchangeGoogleCode, getGoogleUserInfo } from "@/lib/auth/google";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Read state cookie from request header
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/google_oauth_state=([^;]+)/);
  const rawStateCookie = match ? decodeURIComponent(match[1]) : null;

  if (errorParam) {
    console.warn("[Auth/GoogleCallback] User cancelled or Google returned error:", errorParam);
    const redirectRes = NextResponse.redirect(new URL("/login?error=google_cancelled", req.url));
    redirectRes.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0, expires: new Date(0) });
    return redirectRes;
  }

  if (!code || !state || !rawStateCookie) {
    console.error("[Auth/GoogleCallback] Missing code, state, or state cookie.");
    const redirectRes = NextResponse.redirect(new URL("/login?error=invalid_oauth_state", req.url));
    redirectRes.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0, expires: new Date(0) });
    return redirectRes;
  }

  let savedState: { state: string; returnTo: string; redirectUri?: string };
  try {
    savedState = JSON.parse(rawStateCookie);
  } catch {
    savedState = { state: rawStateCookie, returnTo: "/dashboard" };
  }

  if (savedState.state !== state) {
    console.error("[Auth/GoogleCallback] OAuth state mismatch (possible CSRF attempt).");
    const redirectRes = NextResponse.redirect(new URL("/login?error=invalid_oauth_state", req.url));
    redirectRes.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0, expires: new Date(0) });
    return redirectRes;
  }

  try {
    // 1. Exchange code for access tokens using the exact redirect_uri stored during auth initiation
    const tokens = await exchangeGoogleCode(code, savedState.redirectUri);

    // 2. Retrieve verified user profile from Google
    const profile = await getGoogleUserInfo(tokens.access_token);

    if (!profile.email) {
      return NextResponse.redirect(new URL("/login?error=google_email_missing", req.url));
    }

    const normalizedEmail = profile.email.trim().toLowerCase();

    // 3. Find or create user in database
    const MASTER_ADMIN_EMAIL = "madipadiganavtej@gmail.com";

    const [existingUser] = await db
      .select()
      .from(users)
      .where(or(eq(users.googleId, profile.sub), eq(users.email, normalizedEmail)))
      .limit(1);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Update existing user with Google details and verified status
      await db
        .update(users)
        .set({
          googleId: profile.sub,
          avatarUrl: profile.picture || existingUser.avatarUrl,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));

      // Exception, hardcoded explicitly: if the authenticated Google email exactly equals
      // madipadiganavtej@gmail.com, and that email already has BUILDER/ADMIN rows provisioned
      // manually (Task 3 seed script), the OAuth login simply authenticates into the existing
      // account — it does not grant anything new via the OAuth path itself. The role still comes
      // from the DB row seeded, not from the OAuth event.
      if (normalizedEmail !== MASTER_ADMIN_EMAIL) {
        // Ensure user has CLIENT role
        const [clientRole] = await db
          .select()
          .from(userRoles)
          .where(and(eq(userRoles.userId, existingUser.id), eq(userRoles.role, "CLIENT")))
          .limit(1);

        if (!clientRole) {
          await db.insert(userRoles).values({
            userId: existingUser.id,
            role: "CLIENT",
          });
        }
      }
    } else {
      // Create new user strictly with CLIENT role.
      // Security Invariant (Phase 14 Lockdown):
      // On OAuth sign-in, if the user is new, insert user_roles with role = CLIENT only.
      // Never BUILDER, never ADMIN, regardless of email, regardless of any ?role= query param
      // on the OAuth redirect (any ?role= param is completely ignored to prevent state tampering).
      const [newUser] = await db
        .insert(users)
        .values({
          name: profile.name || "Client",
          email: normalizedEmail,
          googleId: profile.sub,
          avatarUrl: profile.picture,
          passwordHash: null,
          emailVerified: true,
        })
        .returning({ id: users.id });

      userId = newUser.id;

      await db.insert(userRoles).values({
        userId: newUser.id,
        role: "CLIENT",
      });
    }

    // 4. Issue authenticated session
    const { rawToken, expiresAt } = await createSession(userId);

    // 5. Redirect user to destination with open-redirect sanitization
    let destination = savedState.returnTo || "/dashboard";

    // Sanitize open redirect: destination must be an internal relative path starting with a single '/'
    if (!destination.startsWith("/") || destination.startsWith("//") || destination.startsWith("/\\")) {
      destination = "/dashboard";
    }

    // Master admin exception: if destination is default client dashboard, direct to /admin instead of hitting client-only portal
    if (normalizedEmail === MASTER_ADMIN_EMAIL && destination === "/dashboard") {
      destination = "/admin";
    }

    const redirectRes = NextResponse.redirect(new URL(destination, req.url));

    redirectRes.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });

    // Clear state cookie
    redirectRes.cookies.set("google_oauth_state", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return redirectRes;
  } catch (err: any) {
    console.error("[Auth/GoogleCallback] Unexpected error:", err);
    if (err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED" || err?.message?.includes("ECONNREFUSED")) {
      return NextResponse.redirect(new URL("/login?error=db_connection_failed", req.url));
    }
    return NextResponse.redirect(new URL("/login?error=google_auth_failed", req.url));
  }
}
