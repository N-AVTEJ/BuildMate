import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/db";
import { users, userRoles, sessions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { GET as googleInitRoute } from "@/app/api/auth/google/route";
import { GET as googleCallbackRoute } from "@/app/api/auth/google/callback/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import * as googleAuthModule from "@/lib/auth/google";

describe("Google OAuth Integration for Client Authentication", () => {
  const testRunId = `gauth_${Date.now()}`;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = "mock-google-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "mock-google-client-secret";
    process.env.APP_URL = "http://localhost:3000";
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("1. GET /api/auth/google generates state cookie and redirects to Google accounts endpoint", async () => {
    const req = new Request("http://localhost:3000/api/auth/google?returnTo=/projects");
    const res = await googleInitRoute(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("client_id=mock-google-client-id");
    expect(location).toContain("scope=openid+email+profile");
    expect(location).toContain("state=");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("google_oauth_state");
  });

  it("2. GET /api/auth/google/callback rejects missing state or state mismatch", async () => {
    const req = new Request("http://localhost:3000/api/auth/google/callback?code=mock_code&state=forged_state");
    const res = await googleCallbackRoute(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login?error=invalid_oauth_state");
  });

  it("3. GET /api/auth/google/callback handles user cancellation", async () => {
    const req = new Request("http://localhost:3000/api/auth/google/callback?error=access_denied");
    const res = await googleCallbackRoute(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login?error=google_cancelled");
  });

  it("4. GET /api/auth/google/callback creates new client user and establishes authenticated session", async () => {
    const validState = "state_123456789";
    const googleSub = `g_sub_${testRunId}`;
    const googleEmail = `google_client_${testRunId}@example.com`;

    // Mock exchangeGoogleCode & getGoogleUserInfo
    vi.spyOn(googleAuthModule, "exchangeGoogleCode").mockResolvedValueOnce({
      access_token: "mock_access_token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "openid email profile",
    });

    vi.spyOn(googleAuthModule, "getGoogleUserInfo").mockResolvedValueOnce({
      sub: googleSub,
      email: googleEmail,
      name: "Google Client User",
      picture: "https://lh3.googleusercontent.com/mock-avatar.jpg",
      email_verified: true,
    });

    const cookieHeader = `google_oauth_state=${JSON.stringify({ state: validState, returnTo: "/dashboard" })}`;

    const req = new Request(`http://localhost:3000/api/auth/google/callback?code=valid_code&state=${validState}`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    const res = await googleCallbackRoute(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("buildmate_session=");

    // Verify user created in DB with CLIENT role
    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleSub))
      .limit(1);

    expect(createdUser).toBeDefined();
    expect(createdUser.email).toBe(googleEmail);
    expect(createdUser.name).toBe("Google Client User");
    expect(createdUser.passwordHash).toBeNull();
    expect(createdUser.emailVerified).toBe(true);
    createdUserIds.push(createdUser.id);

    // Verify role is strictly CLIENT
    const roles = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, createdUser.id));

    expect(roles.length).toBe(1);
    expect(roles[0].role).toBe("CLIENT");
  });

  it("5. POST /api/auth/login instructs Google users to sign in with Google", async () => {
    const googleUserEmail = `g_login_${testRunId}@example.com`;
    const [u] = await db
      .insert(users)
      .values({
        name: "Google Only User",
        email: googleUserEmail,
        googleId: `sub_${testRunId}`,
        passwordHash: null,
        emailVerified: true,
      })
      .returning();
    createdUserIds.push(u.id);

    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: googleUserEmail, password: "AnyPassword123!" }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Continue with Google");
  });

  it("test_oauth_signin_never_grants_builder_or_admin", async () => {
    // Brand new email signing in via Google
    const brandNewEmail = `brand_new_oauth_${Date.now()}@example.com`;
    const brandNewSub = `g_sub_brand_new_${Date.now()}`;
    const validState = `state_brand_new_${Date.now()}`;

    vi.spyOn(googleAuthModule, "exchangeGoogleCode").mockResolvedValueOnce({
      access_token: "mock_token_brand_new",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "openid email profile",
    });

    vi.spyOn(googleAuthModule, "getGoogleUserInfo").mockResolvedValueOnce({
      sub: brandNewSub,
      email: brandNewEmail,
      name: "Brand New User",
      picture: "https://example.com/avatar.png",
      email_verified: true,
    });

    const cookieHeader = `google_oauth_state=${JSON.stringify({ state: validState, returnTo: "/dashboard" })}`;
    const req = new Request(
      `http://localhost:3000/api/auth/google/callback?code=mock_code&state=${validState}`,
      { headers: { Cookie: cookieHeader } }
    );

    const res = await googleCallbackRoute(req);
    expect(res.status).toBe(307);

    // Verify user was created
    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, brandNewEmail))
      .limit(1);

    expect(createdUser).toBeDefined();
    createdUserIds.push(createdUser.id);

    // Assert resulting user_roles contains ONLY CLIENT
    const roles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, createdUser.id));

    expect(roles.length).toBe(1);
    expect(roles[0].role).toBe("CLIENT");
    expect(roles.some((r) => r.role === "BUILDER")).toBe(false);
    expect(roles.some((r) => r.role === "ADMIN")).toBe(false);
  });

  it("test_role_param_on_oauth_redirect_ignored", async () => {
    // Attacker appends ?role=ADMIN and ?role=BUILDER in state tampering attempt
    const tamperedEmail = `tampered_oauth_${Date.now()}@example.com`;
    const tamperedSub = `g_sub_tampered_${Date.now()}`;
    const validState = `state_tampered_${Date.now()}`;

    vi.spyOn(googleAuthModule, "exchangeGoogleCode").mockResolvedValueOnce({
      access_token: "mock_token_tampered",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "openid email profile",
    });

    vi.spyOn(googleAuthModule, "getGoogleUserInfo").mockResolvedValueOnce({
      sub: tamperedSub,
      email: tamperedEmail,
      name: "Tamper Attempt User",
      picture: undefined,
      email_verified: true,
    });

    // Pass ?role=ADMIN&role=BUILDER in query params
    const cookieHeader = `google_oauth_state=${JSON.stringify({ state: validState, returnTo: "/admin" })}`;
    const req = new Request(
      `http://localhost:3000/api/auth/google/callback?code=mock_code&state=${validState}&role=ADMIN&role=BUILDER`,
      { headers: { Cookie: cookieHeader } }
    );

    const res = await googleCallbackRoute(req);
    expect(res.status).toBe(307);

    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, tamperedEmail))
      .limit(1);

    expect(createdUser).toBeDefined();
    createdUserIds.push(createdUser.id);

    // Assert resulting user_roles contains strictly CLIENT and ignores the ?role= parameter
    const roles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, createdUser.id));

    expect(roles.length).toBe(1);
    expect(roles[0].role).toBe("CLIENT");
    expect(roles.map((r) => r.role)).toEqual(["CLIENT"]);
  });
});
