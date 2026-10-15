import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, or, and } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { exchangeGoogleCode, getGoogleUserInfo } from "@/lib/auth/google";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("google_oauth_state");

  // Clean up state cookie
  cookieStore.set("google_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  if (errorParam) {
    console.warn("[Auth/GoogleCallback] User cancelled or Google returned error:", errorParam);
    return NextResponse.redirect(new URL("/login?error=google_cancelled", req.url));
  }

  if (!code || !state || !stateCookie?.value) {
    console.error("[Auth/GoogleCallback] Missing code, state, or state cookie.");
    return NextResponse.redirect(new URL("/login?error=invalid_oauth_state", req.url));
  }

  let savedState: { state: string; returnTo: string };
  try {
    savedState = JSON.parse(stateCookie.value);
  } catch {
    savedState = { state: stateCookie.value, returnTo: "/dashboard" };
  }

  if (savedState.state !== state) {
    console.error("[Auth/GoogleCallback] OAuth state mismatch (possible CSRF attempt).");
    return NextResponse.redirect(new URL("/login?error=invalid_oauth_state", req.url));
  }

  try {
    // 1. Exchange code for access tokens
    const tokens = await exchangeGoogleCode(code);

    // 2. Retrieve verified user profile from Google
    const profile = await getGoogleUserInfo(tokens.access_token);

    if (!profile.email) {
      return NextResponse.redirect(new URL("/login?error=google_email_missing", req.url));
    }

    const normalizedEmail = profile.email.trim().toLowerCase();

    // 3. Find or create user in database
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
    } else {
      // Create new user with CLIENT role
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
    await setSessionCookie(rawToken, expiresAt);

    // 5. Redirect user to destination
    const destination = savedState.returnTo || "/dashboard";
    return NextResponse.redirect(new URL(destination, req.url));
  } catch (err: any) {
    console.error("[Auth/GoogleCallback] Unexpected error:", err);
    if (err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED" || err?.message?.includes("ECONNREFUSED")) {
      return NextResponse.redirect(new URL("/login?error=db_connection_failed", req.url));
    }
    return NextResponse.redirect(new URL("/login?error=google_auth_failed", req.url));
  }
}
