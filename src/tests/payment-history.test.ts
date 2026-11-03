import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { db } from "@/db";
import { users, userRoles, sessions, projects, payments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { GET as paymentHistoryRoute } from "@/app/api/payments/history/route";

describe("Phase 17 Task 2 — Payment History Reporting View", () => {
  const runId = crypto.randomBytes(4).toString("hex");
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdPaymentIds: string[] = [];

  let clientUser: { id: string; rawToken: string };
  let builderUser: { id: string; rawToken: string };
  let otherClientUser: { id: string; rawToken: string };

  let testProject: any;

  beforeAll(async () => {
    // 1. Create client
    const [cUser] = await db
      .insert(users)
      .values({
        name: "History Test Client",
        email: `client_hist_${runId}@example.com`,
        passwordHash: await hashPassword("ValidPassword123!"),
      })
      .returning();
    createdUserIds.push(cUser.id);
    await db.insert(userRoles).values({ userId: cUser.id, role: "CLIENT" });
    const cSession = await createSession(cUser.id);
    clientUser = { id: cUser.id, rawToken: cSession.rawToken };

    // 2. Create other client
    const [ocUser] = await db
      .insert(users)
      .values({
        name: "Other Test Client",
        email: `other_hist_${runId}@example.com`,
        passwordHash: await hashPassword("ValidPassword123!"),
      })
      .returning();
    createdUserIds.push(ocUser.id);
    await db.insert(userRoles).values({ userId: ocUser.id, role: "CLIENT" });
    const ocSession = await createSession(ocUser.id);
    otherClientUser = { id: ocUser.id, rawToken: ocSession.rawToken };

    // 3. Create builder
    const [bUser] = await db
      .insert(users)
      .values({
        name: "History Test Builder",
        email: `builder_hist_${runId}@example.com`,
        passwordHash: await hashPassword("ValidPassword123!"),
      })
      .returning();
    createdUserIds.push(bUser.id);
    await db.insert(userRoles).values({ userId: bUser.id, role: "BUILDER" });
    const bSession = await createSession(bUser.id);
    builderUser = { id: bUser.id, rawToken: bSession.rawToken };

    // 4. Create projects assigned to builder
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-HIST1-${runId}`,
        clientId: clientUser.id,
        builderId: builderUser.id,
        title: "Payment History Verification Project 1",
        subject: "FinTech Module",
        description: "Testing payment history reporting",
        techStack: "Next.js",
        budgetMin: 500,
        budgetMax: 1000,
        totalPrice: 1000,
        advanceAmount: 300,
        remainingAmount: 700,
        status: "IN_PROGRESS",
      })
      .returning();
    createdProjectIds.push(proj.id);
    testProject = proj;

    const [proj2] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-HIST2-${runId}`,
        clientId: clientUser.id,
        builderId: builderUser.id,
        title: "Payment History Verification Project 2",
        subject: "FinTech Module",
        description: "Testing payment history reporting project 2",
        techStack: "Next.js",
        budgetMin: 500,
        budgetMax: 1000,
        totalPrice: 1000,
        advanceAmount: 300,
        remainingAmount: 700,
        status: "IN_PROGRESS",
      })
      .returning();
    createdProjectIds.push(proj2.id);

    // 5. Insert payments with different statuses and Razorpay IDs
    // Payment 1: VERIFIED advance payment on proj1
    const [pay1] = await db
      .insert(payments)
      .values({
        projectId: proj.id,
        type: "ADVANCE",
        expectedAmount: 300,
        submittedAmount: 300,
        status: "VERIFIED",
        razorpayPaymentId: "pay_live_ABC123DEF456",
        verifiedAt: new Date(),
      })
      .returning();
    createdPaymentIds.push(pay1.id);

    // Payment 2: REJECTED payment on proj1
    const [pay2] = await db
      .insert(payments)
      .values({
        projectId: proj.id,
        type: "FINAL",
        expectedAmount: 700,
        submittedAmount: 700,
        status: "REJECTED",
        rejectionReason: "Invalid transaction reference",
        razorpayPaymentId: "pay_live_REJ999XYZ888",
      })
      .returning();
    createdPaymentIds.push(pay2.id);

    // Payment 3: AWAITING payment on proj2 (should show for client, NOT for builder)
    const [pay3] = await db
      .insert(payments)
      .values({
        projectId: proj2.id,
        type: "ADVANCE",
        expectedAmount: 300,
        status: "AWAITING",
      })
      .returning();
    createdPaymentIds.push(pay3.id);
  });

  afterAll(async () => {
    if (createdPaymentIds.length > 0) {
      await db.delete(payments).where(inArray(payments.id, createdPaymentIds));
    }
    if (createdProjectIds.length > 0) {
      await db.delete(projects).where(inArray(projects.id, createdProjectIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("1. GET /api/payments/history requires authentication", async () => {
    const req = new Request("http://localhost:3000/api/payments/history");
    const res = await paymentHistoryRoute(req);
    expect(res.status).toBe(401);
  });

  it("2. Builder receives only VERIFIED and REJECTED payments across their projects", async () => {
    const req = new Request("http://localhost:3000/api/payments/history?role=BUILDER");
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${builderUser.rawToken}` },
      () => paymentHistoryRoute(req)
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.role).toBe("BUILDER");
    expect(Array.isArray(data.payments)).toBe(true);

    // Should include pay1 (VERIFIED) and pay2 (REJECTED), but NOT pay3 (AWAITING)
    const ourPayments = data.payments.filter((p: any) => p.projectId === testProject.id);
    expect(ourPayments.length).toBe(2);

    const statuses = ourPayments.map((p: any) => p.status);
    expect(statuses).toContain("VERIFIED");
    expect(statuses).toContain("REJECTED");
    expect(statuses).not.toContain("AWAITING");

    // Verify truncated payment ID shows last 6 characters
    const verifiedPayment = ourPayments.find((p: any) => p.status === "VERIFIED");
    expect(verifiedPayment.truncatedPaymentId).toBe("...DEF456");
  });

  it("3. Client receives all payments on their own projects including AWAITING", async () => {
    const req = new Request("http://localhost:3000/api/payments/history?role=CLIENT");
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientUser.rawToken}` },
      () => paymentHistoryRoute(req)
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.role).toBe("CLIENT");

    const ourPayments = data.payments.filter((p: any) => createdProjectIds.includes(p.projectId));
    expect(ourPayments.length).toBe(3);

    const statuses = ourPayments.map((p: any) => p.status);
    expect(statuses).toContain("VERIFIED");
    expect(statuses).toContain("REJECTED");
    expect(statuses).toContain("AWAITING");
  });

  it("4. Other client cannot see project payments they do not own", async () => {
    const req = new Request("http://localhost:3000/api/payments/history?role=CLIENT");
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${otherClientUser.rawToken}` },
      () => paymentHistoryRoute(req)
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    const leaked = data.payments.filter((p: any) => createdProjectIds.includes(p.projectId));
    expect(leaked.length).toBe(0);
  });

  it("5. Pagination properly limits and offsets results", async () => {
    const req = new Request("http://localhost:3000/api/payments/history?role=CLIENT&limit=1&offset=0");
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientUser.rawToken}` },
      () => paymentHistoryRoute(req)
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.payments.length).toBe(1);
    expect(data.pagination.limit).toBe(1);
    expect(data.pagination.offset).toBe(0);
    expect(data.pagination.total).toBeGreaterThanOrEqual(3);
    expect(data.pagination.hasMore).toBe(true);
  });

  it("6. PaymentHistoryTable renders status filter and date sort controls", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { PaymentHistoryTable } = await import("@/components/payments/payment-history-table");

    const sampleRow = {
      id: "pay_test_1",
      projectId: "proj_test_1",
      projectCode: "PRJ-2026-0001",
      projectTitle: "Test Project",
      type: "ADVANCE" as const,
      amount: 1500,
      status: "VERIFIED",
      verifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      razorpayPaymentId: "pay_sample_123456",
    };

    const html = renderToStaticMarkup(
      React.createElement(PaymentHistoryTable, {
        initialPayments: [sampleRow],
        role: "BUILDER",
        totalCount: 1,
      })
    );

    expect(html).toContain("Status:");
    expect(html).toContain("All Statuses");
    expect(html).toContain("Date:");
    expect(html).toContain("Newest First");
    expect(html).toContain("PRJ-2026-0001");
    expect(html).toContain("ADVANCE");
    expect(html).toContain("Verified");
  });
});
