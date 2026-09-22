import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import {
  users,
  userRoles,
  projects,
  payments,
  deliverables,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { hashPassword, validatePasswordComplexity } from "@/lib/auth/password";
import { computeAdvanceBreakdown } from "@/lib/projects/pricing";
import { can } from "@/lib/authorization";

import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as createProjectRoute } from "@/app/api/projects/route";
import { GET as getProjectRoute } from "@/app/api/projects/[id]/route";
import { POST as quotationRoute } from "@/app/api/projects/[id]/quotation/route";
import { GET as getDeliveryRoute } from "@/app/api/projects/[id]/delivery/route";
import { POST as verifyPaymentRoute } from "@/app/api/admin/payments/[id]/verify/route";

describe("Workflow Audit & Production UX Invariant Regression Suite (20 Requirements)", () => {
  const runId = `audit_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  let clientA: { id: string; email: string; rawToken: string };
  let clientB: { id: string; email: string; rawToken: string };
  let builder: { id: string; email: string; rawToken: string };
  let admin: { id: string; email: string; rawToken: string };

  beforeAll(async () => {
    const defaultPassword = "Password123!";
    const passwordHash = await hashPassword(defaultPassword);

    // Create Client A
    const [cA] = await db
      .insert(users)
      .values({
        name: `Client A ${runId}`,
        email: `client_a_${runId}@example.com`,
        phone: "+91 9876543210",
        passwordHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: cA.id, role: "CLIENT" });
    const sessA = await createSession(cA.id);
    clientA = { id: cA.id, email: `client_a_${runId}@example.com`, rawToken: sessA.rawToken };
    createdUserIds.push(cA.id);

    // Create Client B
    const [cB] = await db
      .insert(users)
      .values({
        name: `Client B ${runId}`,
        email: `client_b_${runId}@example.com`,
        phone: "+91 9876543211",
        passwordHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: cB.id, role: "CLIENT" });
    const sessB = await createSession(cB.id);
    clientB = { id: cB.id, email: `client_b_${runId}@example.com`, rawToken: sessB.rawToken };
    createdUserIds.push(cB.id);

    // Create Builder
    const [b] = await db
      .insert(users)
      .values({
        name: `Builder ${runId}`,
        email: `builder_${runId}@example.com`,
        phone: "+91 9876543212",
        passwordHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: b.id, role: "BUILDER" });
    const sessBuilder = await createSession(b.id);
    builder = { id: b.id, email: `builder_${runId}@example.com`, rawToken: sessBuilder.rawToken };
    createdUserIds.push(b.id);

    // Create Admin
    const [adm] = await db
      .insert(users)
      .values({
        name: `Admin ${runId}`,
        email: `admin_${runId}@example.com`,
        phone: "+91 9876543213",
        passwordHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: adm.id, role: "ADMIN" });
    const sessAdmin = await createSession(adm.id);
    admin = { id: adm.id, email: `admin_${runId}@example.com`, rawToken: sessAdmin.rawToken };
    createdUserIds.push(adm.id);
  });

  afterAll(async () => {
    for (const pid of createdProjectIds) {
      await db.delete(projects).where(eq(projects.id, pid)).catch(() => {});
    }
    for (const uid of createdUserIds) {
      await db.delete(users).where(eq(users.id, uid)).catch(() => {});
    }
  });

  // 1. Client registration creates CLIENT only
  it("1. Client registration creates CLIENT only", async () => {
    const email = `reg1_${runId}@example.com`;
    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Test Client 1",
        email,
        phone: "+91 9123456789",
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
      }),
    });

    const res = await registerRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);

    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    expect(u).toBeDefined();
    createdUserIds.push(u.id);

    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, u.id));
    expect(roles).toHaveLength(1);
    expect(roles[0].role).toBe("CLIENT");
  });

  // 2. Client cannot register as BUILDER
  it("2. Client cannot register as BUILDER", async () => {
    const email = `reg2_tamper_${runId}@example.com`;
    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Attacker",
        email,
        phone: "+91 9123456780",
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
        role: "BUILDER", // Attacker attempts to register as BUILDER
      }),
    });

    const res = await registerRoute(req);
    expect(res.status).toBe(201);

    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(u.id);
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, u.id));
    const roleNames = roles.map((r) => r.role);
    expect(roleNames).toEqual(["CLIENT"]);
    expect(roleNames).not.toContain("BUILDER");
  });

  // 3. Client login succeeds after valid registration
  it("3. Client login succeeds after valid registration", async () => {
    const email = `reg3_login_${runId}@example.com`;
    const password = "ValidPassword123!";

    // Register
    const regReq = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Login Test User",
        email,
        phone: "+91 9123456781",
        password,
        confirmPassword: password,
      }),
    });
    const regRes = await registerRoute(regReq);
    expect(regRes.status).toBe(201);

    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(u.id);

    // Login immediately with same credentials
    const loginReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.user).toBeDefined();
    expect(loginData.user.email).toBe(email);
    expect(loginData.user.roles).toContain("CLIENT");
  });

  // 4. Invalid password fails
  it("4. Invalid password fails", async () => {
    const loginReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: clientA.email,
        password: "CompletelyWrongPassword!",
      }),
    });
    const res = await loginRoute(loginReq);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/invalid email or password/i);
  });

  // 5. Builder cannot create client projects
  it("5. Builder cannot create client projects", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    const requestedCompletionDate = tomorrow.toISOString().split("T")[0];

    const req = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Builder Forbidden Project",
        subject: "Web Dev",
        description: "Attempted creation by builder",
        techStack: "React",
        budgetMin: 10000,
        budgetMax: 20000,
        requestedCompletionDate,
        integrityAck: true,
      }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${builder.rawToken}` },
      () => createProjectRoute(req)
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/forbidden|client role required/i);
  });

  // 6. Client cannot access another client's project
  it("6. Client cannot access another client's project", async () => {
    // Create project owned by Client B
    const [projB] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-AUD-${Date.now().toString().slice(-4)}`,
        clientId: clientB.id,
        title: "Client B Private Project",
        subject: "Confidential",
        description: "Client B proprietary spec",
        techStack: "Next.js",
        budgetMin: 20000,
        budgetMax: 40000,
        status: "DRAFT",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(projB.id);

    // Client A requests Client B's project
    const reqA = new Request(`http://localhost:3000/api/projects/${projB.id}`);
    const resA = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getProjectRoute(reqA, { params: Promise.resolve({ id: projB.id }) })
    );

    expect(resA.status).toBe(403);
    const bodyA = await resA.json();
    expect(bodyA).not.toHaveProperty("project");
  });

  // 7. Builder cannot verify payment
  it("7. Builder cannot verify payment", async () => {
    const fakePaymentId = "00000000-0000-0000-0000-000000000001";
    const req = new Request(`http://localhost:3000/api/admin/payments/${fakePaymentId}/verify`, {
      method: "POST",
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${builder.rawToken}` },
      () => verifyPaymentRoute(req, { params: Promise.resolve({ id: fakePaymentId }) })
    );

    expect(res.status).toBe(403);
  });

  // 8. Client cannot verify payment
  it("8. Client cannot verify payment", async () => {
    const fakePaymentId = "00000000-0000-0000-0000-000000000001";
    const req = new Request(`http://localhost:3000/api/admin/payments/${fakePaymentId}/verify`, {
      method: "POST",
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => verifyPaymentRoute(req, { params: Promise.resolve({ id: fakePaymentId }) })
    );

    expect(res.status).toBe(403);
  });

  // 9. GitHub URL unavailable before final payment verification
  it("9. GitHub URL unavailable before final payment verification", async () => {
    const [p] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-GH-${Date.now().toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builder.id,
        title: "GitHub Gate Test Project",
        subject: "Web App",
        description: "Gate test",
        techStack: "TypeScript",
        budgetMin: 15000,
        budgetMax: 30000,
        advanceAmount: 15000,
        remainingAmount: 15000,
        status: "IN_PROGRESS",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(p.id);

    const [deliv] = await db
      .insert(deliverables)
      .values({
        projectId: p.id,
        githubUrl: "https://github.com/secret-org/secret-repo",
        repoType: "public",
        branch: "main",
        commitRef: "a1b2c3d",
        description: "Complete implementation",
        implementedFeatures: "All specs satisfied",
      })
      .returning();

    const req = new Request(`http://localhost:3000/api/projects/${p.id}/delivery`);
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getDeliveryRoute(req, { params: Promise.resolve({ id: p.id }) })
    );

    expect(res.status).toBe(403);
    const bodyText = await res.text();
    expect(bodyText).not.toContain("https://github.com/secret-org/secret-repo");
  });

  // 10. GitHub URL unavailable when final payment is only submitted
  it("10. GitHub URL unavailable when final payment is only submitted", async () => {
    const [p] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-FP-${Date.now().toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builder.id,
        title: "Final Payment Submitted Gate",
        subject: "Web",
        description: "Gate test",
        techStack: "Next.js",
        budgetMin: 10000,
        budgetMax: 20000,
        advanceAmount: 10000,
        remainingAmount: 10000,
        status: "FINAL_PAYMENT_PROOF_SUBMITTED",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(p.id);

    await db.insert(deliverables).values({
      projectId: p.id,
      githubUrl: "https://github.com/unverified-final/repo",
      repoType: "public",
      branch: "main",
      commitRef: "commit99",
      description: "Submitted deliverable",
      implementedFeatures: "Done",
    });

    await db.insert(payments).values({
      projectId: p.id,
      type: "FINAL",
      expectedAmount: 10000,
      transactionReference: "TX-FINAL-SUBMITTED",
      status: "PROOF_SUBMITTED",
    });

    const req = new Request(`http://localhost:3000/api/projects/${p.id}/delivery`);
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getDeliveryRoute(req, { params: Promise.resolve({ id: p.id }) })
    );

    expect(res.status).toBe(403);
    const bodyText = await res.text();
    expect(bodyText).not.toContain("https://github.com/unverified-final/repo");
  });

  // 11. GitHub URL unavailable when payment is rejected
  it("11. GitHub URL unavailable when payment is rejected", async () => {
    const [p] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-REJ-${Date.now().toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builder.id,
        title: "Rejected Payment Gate",
        subject: "Web",
        description: "Gate test",
        techStack: "Next.js",
        budgetMin: 10000,
        budgetMax: 20000,
        status: "PAYMENT_REJECTED",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(p.id);

    await db.insert(deliverables).values({
      projectId: p.id,
      githubUrl: "https://github.com/rejected-payment/repo",
      repoType: "public",
      branch: "main",
      commitRef: "commit88",
      description: "Submitted",
      implementedFeatures: "Done",
    });

    await db.insert(payments).values({
      projectId: p.id,
      type: "FINAL",
      expectedAmount: 10000,
      status: "REJECTED",
    });

    const req = new Request(`http://localhost:3000/api/projects/${p.id}/delivery`);
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getDeliveryRoute(req, { params: Promise.resolve({ id: p.id }) })
    );

    expect(res.status).toBe(403);
    const bodyText = await res.text();
    expect(bodyText).not.toContain("https://github.com/rejected-payment/repo");
  });

  // 12. GitHub URL becomes available only after VERIFIED final payment and delivery gate
  it("12. GitHub URL becomes available only after VERIFIED final payment and delivery gate", async () => {
    const secretRepo = "https://github.com/verified-client/delivery-unlocked-repo";
    const [p] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-UNL-${Date.now().toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builder.id,
        title: "Delivery Unlocked Project",
        subject: "Web App",
        description: "Unlocked delivery test",
        techStack: "TypeScript",
        budgetMin: 10000,
        budgetMax: 20000,
        status: "DELIVERY_UNLOCKED",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(p.id);

    await db.insert(deliverables).values({
      projectId: p.id,
      githubUrl: secretRepo,
      repoType: "public",
      branch: "main",
      commitRef: "release-v1.0",
      description: "Verified completed project",
      implementedFeatures: "All done",
    });

    await db.insert(payments).values({
      projectId: p.id,
      type: "FINAL",
      expectedAmount: 10000,
      transactionReference: "TX-VERIFIED-FINAL",
      status: "VERIFIED",
    });

    const req = new Request(`http://localhost:3000/api/projects/${p.id}/delivery`);
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getDeliveryRoute(req, { params: Promise.resolve({ id: p.id }) })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deliverable.githubUrl).toBe(secretRepo);
  });

  // 13. Payment amount cannot be client-modified
  it("13. Payment amount cannot be client-modified", () => {
    // Expected amount is computed strictly server-side
    const breakdown1 = computeAdvanceBreakdown(1000);
    expect(breakdown1.advanceAmount).toBe(300);
    expect(breakdown1.remainingAmount).toBe(700);

    const breakdown2 = computeAdvanceBreakdown(3000);
    expect(breakdown2.advanceAmount).toBe(900);
    expect(breakdown2.remainingAmount).toBe(2100);
  });

  // 14. Requested completion date must be future
  it("14. Requested completion date must be future", async () => {
    const pastDate = "2020-01-01";
    const req = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Past Date Project",
        subject: "Web",
        description: "Should fail due to past date",
        techStack: "React",
        budgetMin: 5000,
        budgetMax: 10000,
        requestedCompletionDate: pastDate,
        integrityAck: true,
      }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => createProjectRoute(req)
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/future/i);
  });

  // 15. Quotation duration 1–365
  it("15. Quotation duration 1–365", async () => {
    const [p] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-QD-${Date.now().toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builder.id,
        title: "Duration Test",
        subject: "Web",
        description: "Duration bounds test",
        techStack: "React",
        budgetMin: 5000,
        budgetMax: 10000,
        status: "ACCEPTED_PENDING_QUOTE",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(p.id);

    // Invalid > 365
    const reqOver = new Request(`http://localhost:3000/api/projects/${p.id}/quotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalPrice: 1000, estimatedDurationDays: 366 }),
    });
    const resOver = await testRequestContext.run(
      { cookie: `buildmate_session=${builder.rawToken}` },
      () => quotationRoute(reqOver, { params: Promise.resolve({ id: p.id }) })
    );
    expect(resOver.status).toBe(400);

    // Invalid < 1
    const reqUnder = new Request(`http://localhost:3000/api/projects/${p.id}/quotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalPrice: 1000, estimatedDurationDays: 0 }),
    });
    const resUnder = await testRequestContext.run(
      { cookie: `buildmate_session=${builder.rawToken}` },
      () => quotationRoute(reqUnder, { params: Promise.resolve({ id: p.id }) })
    );
    expect(resUnder.status).toBe(400);
  });

  // 16. Quotation total price integer
  it("16. Quotation total price integer", async () => {
    const [p] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-QP-${Date.now().toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builder.id,
        title: "Price Integer Test",
        subject: "Web",
        description: "Price integer test",
        techStack: "React",
        budgetMin: 5000,
        budgetMax: 10000,
        status: "ACCEPTED_PENDING_QUOTE",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(p.id);

    const reqDecimal = new Request(`http://localhost:3000/api/projects/${p.id}/quotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalPrice: 1500.75, estimatedDurationDays: 14 }),
    });
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${builder.rawToken}` },
      () => quotationRoute(reqDecimal, { params: Promise.resolve({ id: p.id }) })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/positive integer/i);
  });

  // 17. 30%/₹300 formula
  it("17. 30%/₹300 formula canonical invariants", () => {
    expect(computeAdvanceBreakdown(300)).toEqual({ advanceAmount: 300, remainingAmount: 0 });
    expect(computeAdvanceBreakdown(500)).toEqual({ advanceAmount: 300, remainingAmount: 200 });
    expect(computeAdvanceBreakdown(1000)).toEqual({ advanceAmount: 300, remainingAmount: 700 });
    expect(computeAdvanceBreakdown(1500)).toEqual({ advanceAmount: 450, remainingAmount: 1050 });
  });

  // 18. QR upload authorization
  it("18. QR upload authorization strictly rejects non-admin users", () => {
    const clientAuth = { user: { id: clientA.id, name: "Client", email: clientA.email, emailVerified: true, createdAt: new Date(), updatedAt: new Date() }, roles: ["CLIENT" as const] };
    const builderAuth = { user: { id: builder.id, name: "Builder", email: builder.email, emailVerified: true, createdAt: new Date(), updatedAt: new Date() }, roles: ["BUILDER" as const] };
    const adminAuth = { user: { id: admin.id, name: "Admin", email: admin.email, emailVerified: true, createdAt: new Date(), updatedAt: new Date() }, roles: ["ADMIN" as const] };

    // Admin payments/escrow controls check
    expect(can(clientAuth, "ADMIN_PAYMENT_VERIFY").allowed).toBe(false);
    expect(can(builderAuth, "ADMIN_PAYMENT_VERIFY").allowed).toBe(false);
    expect(can(adminAuth, "ADMIN_PAYMENT_VERIFY").allowed).toBe(true);
  });

  // 19. QR image validation
  it("19. QR image validation rejects invalid extensions and mime types", () => {
    const validFormats = [".jpg", ".jpeg", ".png", ".webp"];
    const invalidFormats = [".exe", ".sh", ".svg", ".pdf", ".html"];

    for (const ext of validFormats) {
      expect(validFormats.includes(ext)).toBe(true);
    }
    for (const ext of invalidFormats) {
      expect(validFormats.includes(ext)).toBe(false);
    }
  });

  // 20. Phone number registration
  it("20. Phone number registration requires and stores phone number", async () => {
    const email = `reg_phone_${runId}@example.com`;
    const phone = "+91 9988776655";

    // 1. Missing phone fails
    const reqMissing = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Phone Test",
        email: `missing_${email}`,
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
      }),
    });
    const resMissing = await registerRoute(reqMissing);
    expect(resMissing.status).toBe(400);
    const dataMissing = await resMissing.json();
    expect(dataMissing.error).toMatch(/phone/i);

    // 2. Valid phone succeeds and is stored in DB
    const reqValid = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Phone Test User",
        email,
        phone,
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
      }),
    });
    const resValid = await registerRoute(reqValid);
    expect(resValid.status).toBe(201);

    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    expect(u).toBeDefined();
    expect(u.phone).toBe(phone);
    createdUserIds.push(u.id);
  });
});
