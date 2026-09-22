import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import {
  users,
  userRoles,
  projects,
  quotations,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { computeAdvanceBreakdown } from "@/lib/projects/pricing";

import { POST as createProjectRoute } from "@/app/api/projects/route";
import { POST as quotationRoute } from "@/app/api/projects/[id]/quotation/route";
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
    // Cleanup projects and users
    for (const pid of createdProjectIds) {
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

    it("rejects estimatedDurationDays outside 1-365 range", async () => {
      const reqZero = new Request(`http://localhost:3000/api/projects/${testProject.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: 2000,
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
          totalPrice: 2000,
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
      expect(data.quotation.totalPrice).toBe(2000);
      expect(data.quotation.advanceAmount).toBe(600); // 30% of 2000
      expect(data.quotation.remainingAmount).toBe(1400); // 70% of 2000
      expect(data.quotation.estimatedDurationDays).toBe(21);
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
