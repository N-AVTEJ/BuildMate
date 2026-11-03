import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import {
  users,
  userRoles,
  projects,
  quotations,
  changeRequests,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { computeAdvanceBreakdown } from "@/lib/projects/pricing";

import { POST as createProjectRoute } from "@/app/api/projects/route";
import { POST as quotationRoute } from "@/app/api/projects/[id]/quotation/route";
import { POST as quotationAcceptRoute } from "@/app/api/projects/[id]/quotation/accept/route";
import { POST as changeRequestRoute } from "@/app/api/projects/[id]/change-requests/route";
import { POST as changeRequestAcceptRoute } from "@/app/api/projects/[id]/change-requests/[crId]/accept/route";
import { POST as createOrderRoute } from "@/app/api/payments/create-order/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";

describe("UX + Portal Completion — Validation & Invariants", () => {
  const testRunId = `ux_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  let clientUser: { id: string; rawToken: string };
  let builderUser: { id: string; rawToken: string };

  beforeAll(async () => {
    const dummyHash = await hashPassword("ValidPassword123!");

    // 1. Create Client User
    const [c] = await db
      .insert(users)
      .values({
        name: `UX Client ${testRunId}`,
        email: `ux_client_${testRunId}@example.com`,
        passwordHash: dummyHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: c.id, role: "CLIENT" });
    const sessClient = await createSession(c.id);
    clientUser = { id: c.id, rawToken: sessClient.rawToken };
    createdUserIds.push(c.id);

    // 2. Create Builder User
    const [b] = await db
      .insert(users)
      .values({
        name: `UX Builder ${testRunId}`,
        email: `ux_builder_${testRunId}@example.com`,
        passwordHash: dummyHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: b.id, role: "BUILDER" });
    const sessBuilder = await createSession(b.id);
    builderUser = { id: b.id, rawToken: sessBuilder.rawToken };
    createdUserIds.push(b.id);
  });

  afterAll(async () => {
    // Cleanup projects, quotations, change requests, and users
    for (const pid of createdProjectIds) {
      await db.delete(changeRequests).where(eq(changeRequests.projectId, pid)).catch(() => {});
      await db.delete(quotations).where(eq(quotations.projectId, pid)).catch(() => {});
      await db.delete(projects).where(eq(projects.id, pid)).catch(() => {});
    }
    for (const uid of createdUserIds) {
      await db.delete(users).where(eq(users.id, uid)).catch(() => {});
    }
  });

  describe("1. Requested Completion Date Validation (POST /api/projects)", () => {
    const baseProjectPayload = {
      title: "E-Commerce App",
      subject: "Full-Stack Web",
      description: "Build a modern e-commerce storefront with PostgreSQL catalog.",
      techStack: "Next.js, TypeScript, PostgreSQL",
      budgetMin: 15000,
      budgetMax: 30000,
      integrityAck: true,
    };

    it("rejects project creation when requestedCompletionDate is missing", async () => {
      const req = new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseProjectPayload),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${clientUser.rawToken}` },
        () => createProjectRoute(req)
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/requested completion date is required/i);
    });

    it("rejects project creation with malformed date format", async () => {
      const req = new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseProjectPayload,
          requestedCompletionDate: "10-25-2026", // Not YYYY-MM-DD
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${clientUser.rawToken}` },
        () => createProjectRoute(req)
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/valid calendar date in YYYY-MM-DD format/i);
    });

    it("rejects project creation when requestedCompletionDate is in the past", async () => {
      const req = new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseProjectPayload,
          requestedCompletionDate: "2020-01-01",
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${clientUser.rawToken}` },
        () => createProjectRoute(req)
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/must be in the future/i);
    });

    it("accepts valid future calendar date and stores requestedCompletionDate", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const req = new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseProjectPayload,
          requestedCompletionDate: futureDateStr,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${clientUser.rawToken}` },
        () => createProjectRoute(req)
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.project).toBeDefined();
      expect(data.project.requestedCompletionDate).toBe(futureDateStr);
      createdProjectIds.push(data.project.id);
    });
  });

  describe("2. Quotation Validation & 30% Advance Formula", () => {
    let testProject: any;

    beforeAll(async () => {
      // Setup project in ACCEPTED_PENDING_QUOTE assigned to builderUser
      const [p] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-UX-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "Quotation Test Project",
          subject: "Mobile App",
          description: "Mobile app specification",
          techStack: "React Native",
          budgetMin: 1000,
          budgetMax: 5000,
          status: "ACCEPTED_PENDING_QUOTE",
          integrityAck: true,
          builderAcceptedAt: new Date(),
        })
        .returning();
      testProject = p;
      createdProjectIds.push(p.id);
    });

    it("verifies canonical advance breakdown formula invariants", () => {
      // ₹300 -> min(300, max(300, 90)) = 300, remaining = 0
      expect(computeAdvanceBreakdown(300)).toEqual({ advanceAmount: 300, remainingAmount: 0 });

      // ₹500 -> min(500, max(300, 150)) = 300, remaining = 200
      expect(computeAdvanceBreakdown(500)).toEqual({ advanceAmount: 300, remainingAmount: 200 });

      // ₹1000 -> min(1000, max(300, 300)) = 300, remaining = 700
      expect(computeAdvanceBreakdown(1000)).toEqual({ advanceAmount: 300, remainingAmount: 700 });

      // ₹1500 -> min(1500, max(300, 450)) = 450, remaining = 1050
      expect(computeAdvanceBreakdown(1500)).toEqual({ advanceAmount: 450, remainingAmount: 1050 });
    });

    it("rejects non-integer totalPrice", async () => {
      const req = new Request(`http://localhost:3000/api/projects/${testProject.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: 1500.5,
          estimatedDurationDays: 14,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => quotationRoute(req, { params: Promise.resolve({ id: testProject.id }) })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/totalPrice must be a positive integer/i);
    });

    it("test_quotation_below_300_rejected: rejects totalPrice below 300 with 400 and preserves database state", async () => {
      const req = new Request(`http://localhost:3000/api/projects/${testProject.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: 15,
          estimatedDurationDays: 14,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => quotationRoute(req, { params: Promise.resolve({ id: testProject.id }) })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Total price must be at least ₹300.");

      const quotes = await db
        .select()
        .from(quotations)
        .where(eq(quotations.projectId, testProject.id));
      expect(quotes.length).toBe(0);

      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, testProject.id));
      expect(proj.totalPrice).toBeNull();
    });

    it("allows totalPrice above 1500 with no maximum cap per Phase 17", async () => {
      const [highValProject] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-HV-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "High Value Project",
          subject: "Enterprise Web",
          description: "Enterprise project testing no maximum cap",
          techStack: "Next.js",
          budgetMin: 1000,
          budgetMax: 50000,
          status: "ACCEPTED_PENDING_QUOTE",
          integrityAck: true,
          builderAcceptedAt: new Date(),
        })
        .returning();
      createdProjectIds.push(highValProject.id);

      const req = new Request(`http://localhost:3000/api/projects/${highValProject.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: 2000,
          estimatedDurationDays: 14,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => quotationRoute(req, { params: Promise.resolve({ id: highValProject.id }) })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.quotation.totalPrice).toBe(2000);
    });

    it("rejects totalPrice 299 (boundary below 300) with 400", async () => {
      const req = new Request(`http://localhost:3000/api/projects/${testProject.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: 299,
          estimatedDurationDays: 14,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => quotationRoute(req, { params: Promise.resolve({ id: testProject.id }) })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Total price must be at least ₹300.");
    });

    it("rejects estimatedDurationDays outside 1-365 range", async () => {
      const reqZero = new Request(`http://localhost:3000/api/projects/${testProject.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: 1500,
          estimatedDurationDays: 0,
        }),
      });

      const resZero = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => quotationRoute(reqZero, { params: Promise.resolve({ id: testProject.id }) })
      );

      expect(resZero.status).toBe(400);
      const dataZero = await resZero.json();
      expect(dataZero.error).toMatch(/estimatedDurationDays must be an integer between 1 and 365/i);
    });

    it("submits quotation with valid whole numbers and computes advance server-side", async () => {
      const req = new Request(`http://localhost:3000/api/projects/${testProject.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: 1500,
          estimatedDurationDays: 21,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => quotationRoute(req, { params: Promise.resolve({ id: testProject.id }) })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.quotation).toBeDefined();
      expect(data.quotation.totalPrice).toBe(1500);
      expect(data.quotation.advanceAmount).toBe(450); // 30% of 1500
      expect(data.quotation.remainingAmount).toBe(1050); // 70% of 1500
      expect(data.quotation.estimatedDurationDays).toBe(21);
    });

    it("test_quotation_floor_enforced_on_all_write_paths: rejects < 300 on initial quote, change-request, and quote accept", async () => {
      // (a) initial quotation < ₹300 rejects with 400
      const quoteReq = new Request(`http://localhost:3000/api/projects/${testProject.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalPrice: 250, estimatedDurationDays: 14 }),
      });
      const quoteRes = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => quotationRoute(quoteReq, { params: Promise.resolve({ id: testProject.id }) })
      );
      expect(quoteRes.status).toBe(400);
      const quoteData = await quoteRes.json();
      expect(quoteData.error).toBe("Total price must be at least ₹300.");

      // (b) change-request recalculation < ₹300 rejects with 400
      const [crProj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-CRFL-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "CR Floor Project",
          subject: "Web",
          description: "Testing CR floor",
          techStack: "Next.js",
          budgetMin: 300,
          budgetMax: 1000,
          totalPrice: 200, // Legacy/low price project
          advanceAmount: 200,
          remainingAmount: 0,
          status: "IN_PROGRESS",
          integrityAck: true,
        })
        .returning();
      createdProjectIds.push(crProj.id);

      const crReq = new Request(`http://localhost:3000/api/projects/${crProj.id}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Scope addition keeping total below ₹300 floor",
          additionalCost: 50, // 200 + 50 = 250 (< 300)
          additionalTimeDays: 2,
        }),
      });
      const crRes = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => changeRequestRoute(crReq, { params: Promise.resolve({ id: crProj.id }) })
      );
      expect(crRes.status).toBe(400);
      const crData = await crRes.json();
      expect(crData.error).toBe("Total price cannot be less than ₹300");

      // (c) quotation accept with price < ₹300 rejects with 400
      const [qaProj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-QAFL-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "QA Floor Project",
          subject: "Web",
          description: "Testing QA floor",
          techStack: "Next.js",
          budgetMin: 300,
          budgetMax: 1000,
          status: "QUOTATION_SENT",
          integrityAck: true,
        })
        .returning();
      createdProjectIds.push(qaProj.id);

      await db.insert(quotations).values({
        projectId: qaProj.id,
        builderId: builderUser.id,
        totalPrice: 200, // < 300
        advanceAmount: 200,
        remainingAmount: 0,
        estimatedDurationDays: 14,
        status: "PENDING",
      });

      const qaReq = new Request(`http://localhost:3000/api/projects/${qaProj.id}/quotation/accept`, {
        method: "POST",
      });
      const qaRes = await testRequestContext.run(
        { cookie: `buildmate_session=${clientUser.rawToken}` },
        () => quotationAcceptRoute(qaReq, { params: Promise.resolve({ id: qaProj.id }) })
      );
      expect(qaRes.status).toBe(400);
      const qaData = await qaRes.json();
      expect(qaData.error).toBe("Total price must be at least ₹300.");

      // (d) change-request accept resulting in total_price < ₹300 rejects with 400
      const [crAcceptProj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-CRAC-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "CR Accept Floor Project",
          subject: "Web",
          description: "Testing CR accept floor",
          techStack: "Next.js",
          budgetMin: 300,
          budgetMax: 1000,
          totalPrice: 400,
          advanceAmount: 200,
          remainingAmount: 200,
          status: "IN_PROGRESS",
          integrityAck: true,
        })
        .returning();
      createdProjectIds.push(crAcceptProj.id);

      const [testCR] = await db
        .insert(changeRequests)
        .values({
          projectId: crAcceptProj.id,
          description: "Negative change request reducing price below 300",
          additionalCost: -150, // 400 - 150 = 250 (< 300)
          additionalTimeDays: 0,
          status: "PENDING",
        })
        .returning();

      const crAcceptReq = new Request(
        `http://localhost:3000/api/projects/${crAcceptProj.id}/change-requests/${testCR.id}/accept`,
        { method: "POST" }
      );
      const crAcceptRes = await testRequestContext.run(
        { cookie: `buildmate_session=${clientUser.rawToken}` },
        () =>
          changeRequestAcceptRoute(crAcceptReq, {
            params: Promise.resolve({ id: crAcceptProj.id, crId: testCR.id }),
          })
      );
      expect(crAcceptRes.status).toBe(400);
      const crAcceptData = await crAcceptRes.json();
      expect(crAcceptData.error).toBe("Total price cannot be less than ₹300");

      // (e) payment create-order on project with quotation < ₹300 rejects with 400
      const [orderFloorProj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-ORDFL-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "Order Floor Project",
          subject: "Web",
          description: "Testing order floor",
          techStack: "Next.js",
          budgetMin: 300,
          budgetMax: 1000,
          status: "AWAITING_ADVANCE",
          integrityAck: true,
        })
        .returning();
      createdProjectIds.push(orderFloorProj.id);

      await db.insert(quotations).values({
        projectId: orderFloorProj.id,
        builderId: builderUser.id,
        totalPrice: 200, // < 300
        advanceAmount: 200,
        remainingAmount: 0,
        estimatedDurationDays: 14,
        status: "ACCEPTED",
      });

      const orderReq = new Request("http://localhost:3000/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: orderFloorProj.id }),
      });
      const orderRes = await testRequestContext.run(
        { cookie: `buildmate_session=${clientUser.rawToken}` },
        () => createOrderRoute(orderReq)
      );
      expect(orderRes.status).toBe(400);
      const orderData = await orderRes.json();
      expect(orderData.error).toBe("Total price cannot be less than ₹300.");
    });
  });

  describe("2.5 Change Request Price Floor Hardening (₹300 minimum, no max cap)", () => {
    let crTestProject: any;

    beforeAll(async () => {
      const [proj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-CR-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "Change Request Band Project",
          subject: "Full-Stack Web",
          description: "Testing CR price band limits",
          techStack: "Next.js",
          budgetMin: 1000,
          budgetMax: 2000,
          totalPrice: 1200,
          advanceAmount: 360,
          remainingAmount: 840,
          status: "IN_PROGRESS",
          integrityAck: true,
        })
        .returning();
      crTestProject = proj;
      createdProjectIds.push(proj.id);
    });

    it("rejects change request pushing resulting total below ₹300", async () => {
      const [lowProj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-CRLOW-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "Low Price CR Project",
          subject: "Full-Stack Web",
          description: "Testing CR price floor limits",
          techStack: "Next.js",
          budgetMin: 300,
          budgetMax: 2000,
          totalPrice: 200,
          advanceAmount: 200,
          remainingAmount: 0,
          status: "IN_PROGRESS",
          integrityAck: true,
        })
        .returning();
      createdProjectIds.push(lowProj.id);

      const req = new Request(`http://localhost:3000/api/projects/${lowProj.id}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Scope addition keeping resulting total below ₹300 floor",
          additionalCost: 50, // 200 + 50 = 250 (< 300)
          additionalTimeDays: 1,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => changeRequestRoute(req, { params: Promise.resolve({ id: lowProj.id }) })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Total price cannot be less than ₹300");

      const crs = await db
        .select()
        .from(changeRequests)
        .where(eq(changeRequests.projectId, lowProj.id));
      expect(crs.length).toBe(0);
    });

    it("accepts change request pushing total above 1500 (no maximum cap)", async () => {
      const req = new Request(`http://localhost:3000/api/projects/${crTestProject.id}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Scope addition pushing total to 1600 (> 1500)",
          additionalCost: 400, // 1200 + 400 = 1600 (> 1500, allowed)
          additionalTimeDays: 7,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => changeRequestRoute(req, { params: Promise.resolve({ id: crTestProject.id }) })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.changeRequest).toBeDefined();
      expect(data.changeRequest.additionalCost).toBe(400);
    });
  });

  describe("3. Registration Separation & Role Hardening", () => {
    it("strictly assigns CLIENT role even if client submits role=BUILDER in registration payload", async () => {
      const attackerEmail = `attacker_reg_${testRunId}@example.com`;
      const req = new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Attacker",
          email: attackerEmail,
          phone: "+91 9876543210",
          password: "SecurePassword123!",
          confirmPassword: "SecurePassword123!",
          role: "BUILDER", // Malicious attempt to self-escalate to BUILDER
        }),
      });

      const res = await registerRoute(req);
      expect(res.status).toBe(201);

      // Verify created user in DB
      const [u] = await db.select().from(users).where(eq(users.email, attackerEmail)).limit(1);
      expect(u).toBeDefined();
      createdUserIds.push(u.id);

      const roles = await db.select().from(userRoles).where(eq(userRoles.userId, u.id));
      expect(roles).toHaveLength(1);
      expect(roles[0].role).toBe("CLIENT"); // Never BUILDER
    });
  });
});
