import { describe, it, expect, vi } from "vitest";

// Mock next/headers for route testing
vi.mock("next/headers", () => {
  const cookieMap = new Map<string, any>();
  return {
    cookies: vi.fn(async () => ({
      get: vi.fn((name: string) => cookieMap.get(name)),
      set: vi.fn((name: string, val: any, opts: any) => cookieMap.set(name, { value: val, ...opts })),
      delete: vi.fn((name: string) => cookieMap.delete(name)),
    })),
    headers: vi.fn(async () => new Headers()),
  };
});

import crypto from "crypto";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as builderSetupRoute } from "@/app/api/auth/builder-setup/route";
import { db } from "@/db";
import { users, userRoles, emailVerificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/auth/session";
import fs from "fs";
import path from "path";

describe("Builder vs Client Auth Separation & Provisioned Builder Verification", () => {
  it("1. buildrazor@gmail.com exists in database with BUILDER role", async () => {
    const [builderUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "buildrazor@gmail.com"))
      .limit(1);

    expect(builderUser).toBeDefined();
    expect(builderUser.email).toBe("buildrazor@gmail.com");

    const roles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, builderUser.id));

    const roleNames = roles.map((r) => r.role);
    expect(roleNames).toContain("BUILDER");
    expect(roleNames).not.toContain("ADMIN");
  });

  it("2. POST /api/auth/login authenticates buildrazor@gmail.com with razor123", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "buildrazor@gmail.com",
        password: "razor123",
      }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("buildrazor@gmail.com");
    expect(data.user.roles).toContain("BUILDER");
  });

  it("3. /builder/login source code strictly contains NO Google OAuth elements or buttons", () => {
    const builderLoginPath = path.join(
      process.cwd(),
      "src/app/builder/login/page.tsx"
    );
    expect(fs.existsSync(builderLoginPath)).toBe(true);

    const source = fs.readFileSync(builderLoginPath, "utf-8");

    // Strictly verify no Google button or Google OAuth endpoints are present
    expect(source).not.toContain("GoogleSignInButton");
    expect(source).not.toContain("/api/auth/google");
    expect(source).not.toContain("Continue with Google");
    expect(source).not.toContain("Sign Up with Google");
    expect(source).toContain("Builder Command Center");
    expect(source).toContain("BUILDER role");
  });

  it("4. /builder/apply links builders to /builder/login instead of /login", () => {
    const builderApplyPath = path.join(
      process.cwd(),
      "src/app/builder/apply/page.tsx"
    );
    const source = fs.readFileSync(builderApplyPath, "utf-8");

    expect(source).toContain('href="/builder/login"');
  });

  it("5. /builder and /builder/projects/[id] guard redirect unauthenticated users to /builder/login", () => {
    const builderPagePath = path.join(
      process.cwd(),
      "src/app/builder/page.tsx"
    );
    const builderSource = fs.readFileSync(builderPagePath, "utf-8");
    expect(builderSource).toContain('redirect("/builder/login")');

    const projectDetailPath = path.join(
      process.cwd(),
      "src/app/builder/projects/[id]/page.tsx"
    );
    const projectSource = fs.readFileSync(projectDetailPath, "utf-8");
    expect(projectSource).toContain('redirect("/builder/login")');
  });

  it("6. Builder setup token flow sets password and enables successful login via POST /api/auth/login", async () => {
    const testEmail = `newbuilder_${Date.now()}@example.com`;
    const [user] = await db
      .insert(users)
      .values({
        name: "New Builder",
        email: testEmail,
        passwordHash: "PENDING_SETUP",
        emailVerified: true,
      })
      .returning();

    await db.insert(userRoles).values({ userId: user.id, role: "BUILDER" });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
      used: false,
    });

    // Set password via builder-setup route
    const setupReq = new Request("http://localhost:3000/api/auth/builder-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, password: "StrongBuilderPassword123!" }),
    });
    const setupRes = await builderSetupRoute(setupReq);
    expect(setupRes.status).toBe(200);

    // Now log in via loginRoute
    const loginReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "StrongBuilderPassword123!" }),
    });
    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.user.email).toBe(testEmail);
    expect(loginData.user.roles).toContain("BUILDER");

    // Clean up
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, user.id));
    await db.delete(userRoles).where(eq(userRoles.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  });
});
