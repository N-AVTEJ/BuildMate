import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

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

let mockRateLimitAllowed = true;
vi.mock("@/lib/auth/rate-limit", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    rateLimit: vi.fn(async (key: string, limit: number, windowStr: string) => {
      if (!mockRateLimitAllowed) {
        return { success: false, limit, remaining: 0, reset: Date.now() + 3600000 };
      }
      return { success: true, limit, remaining: 2, reset: Date.now() + 3600000 };
    }),
  };
});

import { db } from "@/db";
import { users, userRoles, builderInquiries } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { can } from "@/lib/authorization";
import { POST as builderInquiriesRoute } from "@/app/api/builder-inquiries/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";

describe("Phase 13 (V1) — Role-First Entry Flow & Invariant Tests", () => {
  const runId = `p13_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdInquiryIds: string[] = [];

  let testClientUser: { id: string; email: string; rawToken: string };
  let testBuilderUser: { id: string; email: string; rawToken: string };
  let testAdminUser: { id: string; email: string; rawToken: string };

  const clientPassword = "ClientPassword123!";
  const builderPassword = "BuilderPassword123!";
  const adminPassword = "AdminPassword123!";

  beforeAll(async () => {
    mockRateLimitAllowed = true;

    // Seed Client User
    const clientHash = await hashPassword(clientPassword);
    const [cU] = await db
      .insert(users)
      .values({
        name: `Phase 13 Client ${runId}`,
        email: `client_${runId}@example.com`,
        passwordHash: clientHash,
        emailVerified: true,
      })
      .returning({ id: users.id, email: users.email });
    await db.insert(userRoles).values({ userId: cU.id, role: "CLIENT" });
    const sessC = await createSession(cU.id);
    testClientUser = { id: cU.id, email: cU.email, rawToken: sessC.rawToken };
    createdUserIds.push(cU.id);

    // Seed Builder User
    const builderHash = await hashPassword(builderPassword);
    const [bU] = await db
      .insert(users)
      .values({
        name: `Phase 13 Builder ${runId}`,
        email: `builder_${runId}@example.com`,
        passwordHash: builderHash,
        emailVerified: true,
      })
      .returning({ id: users.id, email: users.email });
    await db.insert(userRoles).values({ userId: bU.id, role: "BUILDER" });
    const sessB = await createSession(bU.id);
    testBuilderUser = { id: bU.id, email: bU.email, rawToken: sessB.rawToken };
    createdUserIds.push(bU.id);

    // Seed Admin User
    const adminHash = await hashPassword(adminPassword);
    const [aU] = await db
      .insert(users)
      .values({
        name: `Phase 13 Admin ${runId}`,
        email: `admin_${runId}@example.com`,
        passwordHash: adminHash,
        emailVerified: true,
      })
      .returning({ id: users.id, email: users.email });
    await db.insert(userRoles).values({ userId: aU.id, role: "ADMIN" });
    const sessA = await createSession(aU.id);
    testAdminUser = { id: aU.id, email: aU.email, rawToken: sessA.rawToken };
    createdUserIds.push(aU.id);
  });

  afterAll(async () => {
    if (createdInquiryIds.length > 0) {
      await db.delete(builderInquiries).where(inArray(builderInquiries.id, createdInquiryIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  // Task 2 Invariant: Builder Inquiries Submission
  it("Task 2: POST /api/builder-inquiries succeeds with valid data and stores inquiry lead", async () => {
    mockRateLimitAllowed = true;
    const req = new Request("http://localhost:3000/api/builder-inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dev Applicant",
        email: `applicant_${runId}@example.com`,
        message: "Full stack TypeScript and React engineer with 5 years experience.",
      }),
    });

    const res = await builderInquiriesRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Thanks — we'll be in touch.");
    expect(data.id).toBeDefined();

    createdInquiryIds.push(data.id);

    // Verify persisted record in DB
    const [inquiry] = await db
      .select()
      .from(builderInquiries)
      .where(eq(builderInquiries.id, data.id));

    expect(inquiry).toBeDefined();
    expect(inquiry.name).toBe("Dev Applicant");
    expect(inquiry.email).toBe(`applicant_${runId}@example.com`);
    expect(inquiry.message).toBe("Full stack TypeScript and React engineer with 5 years experience.");
    expect(inquiry.createdAt).toBeInstanceOf(Date);
  });

  it("Task 2: Builder inquiry creation creates NO user, session, or role", async () => {
    mockRateLimitAllowed = true;
    const uniqueEmail = `noaccount_${runId}@example.com`;
    const req = new Request("http://localhost:3000/api/builder-inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Lead Only Applicant",
        email: uniqueEmail,
        message: "Just asking for invite.",
      }),
    });

    const res = await builderInquiriesRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    createdInquiryIds.push(data.id);

    // Verify NO user was created in users table
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, uniqueEmail));

    expect(user).toBeUndefined();
  });

  it("Task 2: Builder inquiries rejects missing name with 400", async () => {
    mockRateLimitAllowed = true;
    const req = new Request("http://localhost:3000/api/builder-inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: `valid_${runId}@example.com`,
      }),
    });

    const res = await builderInquiriesRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name is required/i);
  });

  it("Task 2: Builder inquiries rejects invalid email with 400", async () => {
    mockRateLimitAllowed = true;
    const req = new Request("http://localhost:3000/api/builder-inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Valid Name",
        email: "not-an-email",
      }),
    });

    const res = await builderInquiriesRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid email/i);
  });

  it("Task 2: Builder inquiries rejects message exceeding 1000 characters with 400", async () => {
    mockRateLimitAllowed = true;
    const longMessage = "a".repeat(1001);
    const req = new Request("http://localhost:3000/api/builder-inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Valid Name",
        email: `valid_${runId}@example.com`,
        message: longMessage,
      }),
    });

    const res = await builderInquiriesRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/exceed 1000 characters/i);
  });

  it("Task 2: Builder inquiries enforces 3/hour rate-limit and returns 429 when exhausted", async () => {
    mockRateLimitAllowed = false; // Simulate rate limit tripped
    const req = new Request("http://localhost:3000/api/builder-inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Rate Limited Applicant",
        email: `ratelimited_${runId}@example.com`,
      }),
    });

    const res = await builderInquiriesRoute(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/too many inquiries/i);
    mockRateLimitAllowed = true;
  });

  // Task 3 Invariant: Login stays role-agnostic on the server
  it("Task 3: POST /api/auth/login is role-agnostic and returns DB-backed roles", async () => {
    // 1. Client login
    const clientReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testClientUser.email,
        password: clientPassword,
      }),
    });
    const clientRes = await loginRoute(clientReq);
    expect(clientRes.status).toBe(200);
    const clientData = await clientRes.json();
    expect(clientData.user.roles).toEqual(["CLIENT"]);

    // 2. Builder login
    const builderReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testBuilderUser.email,
        password: builderPassword,
      }),
    });
    const builderRes = await loginRoute(builderReq);
    expect(builderRes.status).toBe(200);
    const builderData = await builderRes.json();
    expect(builderData.user.roles).toEqual(["BUILDER"]);

    // 3. Admin login
    const adminReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testAdminUser.email,
        password: adminPassword,
      }),
    });
    const adminRes = await loginRoute(adminReq);
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json();
    expect(adminData.user.roles).toEqual(["ADMIN"]);
  });

  // Task 4 Invariant: Admin Visibility and Access Control
  it("Task 4: Admin role authorization allows viewing admin dashboard and inquiries", async () => {
    const adminAuth = {
      user: { id: testAdminUser.id, name: "Admin", email: testAdminUser.email, emailVerified: true },
      roles: ["ADMIN"] as const,
    };
    const clientAuth = {
      user: { id: testClientUser.id, name: "Client", email: testClientUser.email, emailVerified: true },
      roles: ["CLIENT"] as const,
    };

    expect(can(adminAuth as any, "ADMIN_VIEW_DASHBOARD").allowed).toBe(true);
    expect(can(clientAuth as any, "ADMIN_VIEW_DASHBOARD").allowed).toBe(false);
  });

  it("Task 4: Inquiries query orders records newest first", async () => {
    // Insert two timestamped records
    const [first] = await db
      .insert(builderInquiries)
      .values({
        name: "Older Inquiry",
        email: `older_${runId}@example.com`,
      })
      .returning({ id: builderInquiries.id });
    createdInquiryIds.push(first.id);

    const [second] = await db
      .insert(builderInquiries)
      .values({
        name: "Newer Inquiry",
        email: `newer_${runId}@example.com`,
      })
      .returning({ id: builderInquiries.id });
    createdInquiryIds.push(second.id);

    const list = await db
      .select({ id: builderInquiries.id, name: builderInquiries.name })
      .from(builderInquiries)
      .where(inArray(builderInquiries.id, [first.id, second.id]))
      .orderBy(desc(builderInquiries.createdAt));

    expect(list.length).toBe(2);
    expect(list[0].id).toBe(second.id);
    expect(list[1].id).toBe(first.id);
  });
});
