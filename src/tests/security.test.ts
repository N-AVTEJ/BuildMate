import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import {
  users,
  userRoles,
  sessions,
  projects,
  payments,
  paymentProofs,
  deliverables,
  projectStatusHistory,
  notifications,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { registerMockFile, clearMockStorage, generatePaymentProofKey } from "@/lib/storage";
import { can, AuthAction } from "@/lib/authorization";

// Real application routes under test
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as createProjectRoute } from "@/app/api/projects/route";
import { GET as getProjectRoute } from "@/app/api/projects/[id]/route";
import { POST as submitProofRoute } from "@/app/api/payments/proof/route";
import { GET as getPaymentRoute } from "@/app/api/payments/[id]/route";
import { GET as getDeliveryRoute } from "@/app/api/projects/[id]/delivery/route";
import { POST as verifyPaymentRoute } from "@/app/api/admin/payments/[id]/verify/route";

describe("Phase 10 — Security Hardening & Invariant Integration Tests", () => {
  const testRunId = `sec_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  let clientA: { id: string; rawToken: string };
  let clientB: { id: string; rawToken: string };
  let builderUser: { id: string; rawToken: string };
  let adminUser: { id: string; rawToken: string };

  beforeAll(async () => {
    // 1. Create real test users directly in DB
    const dummyHash = await hashPassword("TestPassword123!");

    // Client A
    const [uA] = await db
      .insert(users)
      .values({
        name: `Client A ${testRunId}`,
        email: `client_a_${testRunId}@example.com`,
        passwordHash: dummyHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: uA.id, role: "CLIENT" });
    const sessA = await createSession(uA.id);
    clientA = { id: uA.id, rawToken: sessA.rawToken };
    createdUserIds.push(uA.id);

    // Client B
    const [uB] = await db
      .insert(users)
      .values({
        name: `Client B ${testRunId}`,
        email: `client_b_${testRunId}@example.com`,
        passwordHash: dummyHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: uB.id, role: "CLIENT" });
    const sessB = await createSession(uB.id);
    clientB = { id: uB.id, rawToken: sessB.rawToken };
    createdUserIds.push(uB.id);

    // Builder
    const [uBuilder] = await db
      .insert(users)
      .values({
        name: `Builder ${testRunId}`,
        email: `builder_${testRunId}@example.com`,
        passwordHash: dummyHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: uBuilder.id, role: "BUILDER" });
    const sessBuilder = await createSession(uBuilder.id);
    builderUser = { id: uBuilder.id, rawToken: sessBuilder.rawToken };
    createdUserIds.push(uBuilder.id);

    // Admin
    const [uAdmin] = await db
      .insert(users)
      .values({
        name: `Admin ${testRunId}`,
        email: `admin_${testRunId}@example.com`,
        passwordHash: dummyHash,
        emailVerified: true,
      })
      .returning({ id: users.id });
    await db.insert(userRoles).values({ userId: uAdmin.id, role: "ADMIN" });
    const sessAdmin = await createSession(uAdmin.id);
    adminUser = { id: uAdmin.id, rawToken: sessAdmin.rawToken };
    createdUserIds.push(uAdmin.id);
  });

  afterAll(async () => {
    // Deterministic teardown of test data
    clearMockStorage();
    if (createdProjectIds.length > 0) {
      await db.delete(deliverables).where(inArray(deliverables.projectId, createdProjectIds));
      await db.delete(paymentProofs);
      await db.delete(payments).where(inArray(payments.projectId, createdProjectIds));
      await db.delete(projectStatusHistory).where(inArray(projectStatusHistory.projectId, createdProjectIds));
      await db.delete(projects).where(inArray(projects.id, createdProjectIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(notifications).where(inArray(notifications.userId, createdUserIds));
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  /**
   * 1. test_payment_amount_cannot_be_client_modified
   * Submit a payment proof with a spoofed expected_amount/submitted_amount in the body
   * that differs from project.advance_amount. Assert the stored payments.expected_amount
   * matches the server-derived value, not the spoofed one.
   */
  it("test_payment_amount_cannot_be_client_modified", async () => {
    // Setup: project awaiting advance with advanceAmount = 50000
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-SEC-${Date.now().toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builderUser.id,
        title: "Security Test Project 1",
        subject: "Web Development",
        description: "Testing client amount injection immunity",
        techStack: "TypeScript, PostgreSQL",
        budgetMin: 50000,
        budgetMax: 100000,
        totalPrice: 100000,
        advanceAmount: 50000,
        remainingAmount: 50000,
        status: "AWAITING_ADVANCE",
        integrityAck: true,
        advancePaymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();
    createdProjectIds.push(proj.id);

    const storageKey = generatePaymentProofKey(proj.id, "ADVANCE", ".png");
    registerMockFile(storageKey, 2048, "image/png");

    // Client attempts to spoof expected_amount and submitted_amount to 1
    const attackPayload = {
      projectId: proj.id,
      transactionReference: "UPI-ATTACK-001",
      storageKey,
      fileType: "image/png",
      fileSize: 2048,
      expected_amount: 1,
      expectedAmount: 1,
      submitted_amount: 1,
      submittedAmount: 1,
    };

    const req = new Request("http://localhost:3000/api/payments/proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attackPayload),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => submitProofRoute(req)
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Assert stored payment in DB matches the server-derived value (50000), not the spoofed 1
    const [storedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.projectId, proj.id))
      .limit(1);

    expect(storedPayment).toBeDefined();
    expect(storedPayment.expectedAmount).toBe(50000);
    expect(storedPayment.expectedAmount).not.toBe(1);
    expect(storedPayment.submittedAmount).toBeNull();
  });

  /**
   * 2. test_delivery_locked_until_final_payment_verified
   * Hit the Phase 8 delivery endpoint on a project with advance verified but final payment
   * still PROOF_SUBMITTED (not VERIFIED). Assert 403/locked and assert the raw response body
   * contains no github_url, deployment_url, or file URL fields anywhere.
   */
  it("test_delivery_locked_until_final_payment_verified", async () => {
    // Setup: project with deliverable, but final payment is PROOF_SUBMITTED (not VERIFIED)
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-SEC-${(Date.now() + 1).toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builderUser.id,
        title: "Security Test Project 2",
        subject: "Web App",
        description: "Delivery locked verification",
        techStack: "React, Node.js",
        budgetMin: 30000,
        budgetMax: 60000,
        advanceAmount: 30000,
        remainingAmount: 30000,
        status: "FINAL_PAYMENT_PROOF_SUBMITTED",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(proj.id);

    // Insert deliverable containing sensitive repo and deployment URLs
    await db.insert(deliverables).values({
      projectId: proj.id,
      githubUrl: "https://github.com/secret-org/super-secret-repo",
      repoType: "PUBLIC",
      branch: "main",
      commitRef: "a1b2c3d4e5",
      description: "Secret deliverable description",
      implementedFeatures: "All secret features",
      documentationUrl: "https://docs.secret-org.com",
      demoUrl: "https://secret-demo.vercel.app",
      deploymentUrl: "https://secret-app.vercel.app",
      screenshots: ["https://secret-storage.com/proof.png"],
    });

    // Advance payment is verified
    await db.insert(payments).values({
      projectId: proj.id,
      type: "ADVANCE",
      expectedAmount: 30000,
      transactionReference: "ADV-VERIFIED-TX",
      status: "VERIFIED",
    });

    // Final payment is PROOF_SUBMITTED (unverified)
    await db.insert(payments).values({
      projectId: proj.id,
      type: "FINAL",
      expectedAmount: 30000,
      transactionReference: "FINAL-PENDING-TX",
      status: "PROOF_SUBMITTED",
    });

    const req = new Request(`http://localhost:3000/api/projects/${proj.id}/delivery`);
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getDeliveryRoute(req, { params: Promise.resolve({ id: proj.id }) })
    );

    // Assert 403 / locked
    expect(res.status).toBe(403);
    const rawText = await res.text();
    const parsed = JSON.parse(rawText);
    expect(parsed.locked).toBe(true);

    // Assert raw body contains zero sensitive deliverable URLs
    expect(rawText).not.toContain("github_url");
    expect(rawText).not.toContain("super-secret-repo");
    expect(rawText).not.toContain("deployment_url");
    expect(rawText).not.toContain("secret-app.vercel.app");
    expect(rawText).not.toContain("secret-demo.vercel.app");
    expect(rawText).not.toContain("secret-storage.com");
  });

  /**
   * 3. test_client_cannot_access_other_clients_project
   * Create two client accounts, two projects. Client A hits /api/projects/:id for Client B's project.
   * Assert 403, and assert the response doesn't leak whether the project exists (same shape as a request for a genuinely nonexistent ID).
   */
  it("test_client_cannot_access_other_clients_project", async () => {
    // Project owned by Client B
    const [projB] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-SEC-${(Date.now() + 2).toString().slice(-4)}`,
        clientId: clientB.id,
        title: "Client B Secret Project",
        subject: "Mobile Development",
        description: "Confidential specs of Client B",
        techStack: "Flutter",
        budgetMin: 40000,
        budgetMax: 80000,
        status: "DRAFT",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(projB.id);

    // Client A hits /api/projects/:id for Client B's project
    const reqA = new Request(`http://localhost:3000/api/projects/${projB.id}`);
    const resA = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getProjectRoute(reqA, { params: Promise.resolve({ id: projB.id }) })
    );

    expect(resA.status).toBe(403);
    const bodyA = await resA.json();
    expect(bodyA).toHaveProperty("error");
    expect(typeof bodyA.error).toBe("string");
    // Does not leak project details or titles
    expect(bodyA).not.toHaveProperty("project");
    expect(JSON.stringify(bodyA)).not.toContain("Client B Secret Project");

    // Hit a genuinely nonexistent ID
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const reqFake = new Request(`http://localhost:3000/api/projects/${fakeId}`);
    const resFake = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getProjectRoute(reqFake, { params: Promise.resolve({ id: fakeId }) })
    );

    expect(resFake.status).toBe(404);
    const bodyFake = await resFake.json();
    expect(bodyFake).toHaveProperty("error");
    // Both responses share the exact same top-level shape: { error: string }
    expect(Object.keys(bodyA)).toEqual(Object.keys(bodyFake));
  });

  /**
   * 4. test_client_cannot_access_other_clients_payment_proof
   * Same two-client setup. Client A requests a presigned download URL for Client B's payment proof.
   * Assert 403 and assert no signed URL is returned.
   */
  it("test_client_cannot_access_other_clients_payment_proof", async () => {
    // Project and payment proof for Client B
    const [projB] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-SEC-${(Date.now() + 3).toString().slice(-4)}`,
        clientId: clientB.id,
        title: "Client B Financials",
        subject: "Fintech",
        description: "Payment details",
        techStack: "Go",
        budgetMin: 20000,
        budgetMax: 50000,
        advanceAmount: 20000,
        remainingAmount: 20000,
        status: "AWAITING_ADVANCE",
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(projB.id);

    const [paymentB] = await db
      .insert(payments)
      .values({
        projectId: projB.id,
        type: "ADVANCE",
        expectedAmount: 20000,
        transactionReference: "CLIENT-B-UPI-PROOF",
        status: "PROOF_SUBMITTED",
      })
      .returning();

    const storageKey = generatePaymentProofKey(projB.id, "ADVANCE", ".png");
    registerMockFile(storageKey, 1024, "image/png");

    await db.insert(paymentProofs).values({
      paymentId: paymentB.id,
      fileUrl: storageKey,
      fileType: "image/png",
      fileSize: 1024,
    });

    // Client A requests Client B's payment details / presigned proof download URL
    const req = new Request(`http://localhost:3000/api/payments/${paymentB.id}`);
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => getPaymentRoute(req, { params: Promise.resolve({ id: paymentB.id }) })
    );

    expect(res.status).toBe(403);
    const rawText = await res.text();
    expect(rawText).not.toContain("downloadUrl");
    expect(rawText).not.toContain(storageKey);
    expect(rawText).not.toContain("CLIENT-B-UPI-PROOF");
  });

  /**
   * 5. test_role_cannot_be_set_via_registration_payload
   * Register with { ..., role: "ADMIN" } in the body. Assert the created user's
   * user_roles only contains CLIENT, never ADMIN.
   */
  it("test_role_cannot_be_set_via_registration_payload", async () => {
    const maliciousEmail = `attacker_${Date.now()}@example.com`;
    const payload = {
      name: "Privilege Escalation Attacker",
      email: maliciousEmail,
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword123!",
      role: "ADMIN",
      roles: ["ADMIN", "CLIENT"],
      isAdmin: true,
    };

    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await registerRoute(req);
    expect(res.status).toBe(201);

    // Look up created user in database
    const [createdUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, maliciousEmail.toLowerCase()))
      .limit(1);

    expect(createdUser).toBeDefined();
    createdUserIds.push(createdUser.id);

    // Fetch assigned roles directly from user_roles table
    const assignedRoles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, createdUser.id));

    const roleNames = assignedRoles.map((r) => r.role);

    // Strictly assert: Contains CLIENT, NEVER contains ADMIN
    expect(roleNames).toEqual(["CLIENT"]);
    expect(roleNames).not.toContain("ADMIN");
  });

  /**
   * 6. test_server_side_deadline_computation
   * Manipulate the request in a way that simulates a spoofed client clock
   * (e.g. send a custom header or body field claiming "current time") on any deadline-sensitive endpoint.
   * Assert the server ignores it entirely and uses actual server now() for all deadline math.
   */
  it("test_server_side_deadline_computation", async () => {
    // Target route: POST /api/projects (calculates acceptanceDeadline = server now + 48 hours)
    const spoofedFutureDate = new Date("2035-01-01T00:00:00Z");

    const payload = {
      title: "Clock Spoofing Defense Project",
      subject: "Systems Security",
      description: "Testing that client timestamp headers and body claims are ignored",
      techStack: "Rust, Next.js",
      budgetMin: 30000,
      budgetMax: 70000,
      integrityAck: true,
      // Spoofed body properties claiming client current time is in the future
      current_time: spoofedFutureDate.toISOString(),
      now: spoofedFutureDate.toISOString(),
      timestamp: spoofedFutureDate.getTime(),
      deadline: spoofedFutureDate.toISOString(),
    };

    const req = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Spoofed HTTP headers claiming client clock is in 2035
        "X-Client-Time": spoofedFutureDate.toISOString(),
        Date: spoofedFutureDate.toUTCString(),
      },
      body: JSON.stringify(payload),
    });

    const beforeCall = Date.now();
    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => createProjectRoute(req)
    );
    const afterCall = Date.now();

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.project).toBeDefined();
    createdProjectIds.push(data.project.id);

    // Query project row fresh from DB
    const [projectRow] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, data.project.id))
      .limit(1);

    expect(projectRow.acceptanceDeadline).toBeDefined();

    // Server-computed deadline MUST be approximately server now + 48 hours (within 10 seconds)
    const expectedMin = new Date(beforeCall + 48 * 60 * 60 * 1000 - 10000);
    const expectedMax = new Date(afterCall + 48 * 60 * 60 * 1000 + 10000);

    const actualDeadline = new Date(projectRow.acceptanceDeadline!).getTime();
    expect(actualDeadline).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(actualDeadline).toBeLessThanOrEqual(expectedMax.getTime());

    // Assert it is nowhere near the spoofed 2035 date
    expect(actualDeadline).toBeLessThan(spoofedFutureDate.getTime());
  });

  /**
   * 7. test_expired_advance_window_blocks_activation
   * Backdate a test project's advance_payment_deadline into the past while status is still AWAITING_ADVANCE.
   * Attempt to submit/verify a payment proof anyway. Assert the system flags it as late (LATE_PAYMENT_PROOF, per Phase 6)
   * rather than silently activating the project, and assert IN_PROGRESS is never reached without an explicit admin action.
   */
  it("test_expired_advance_window_blocks_activation", async () => {
    // 1. Setup project with backdated advancePaymentDeadline (2 days in the past)
    const pastDeadline = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-SEC-${(Date.now() + 4).toString().slice(-4)}`,
        clientId: clientA.id,
        builderId: builderUser.id,
        title: "Late Payment Project",
        subject: "Web Development",
        description: "Testing late payment blocking",
        techStack: "PostgreSQL",
        budgetMin: 40000,
        budgetMax: 80000,
        advanceAmount: 40000,
        remainingAmount: 40000,
        status: "AWAITING_ADVANCE",
        advancePaymentDeadline: pastDeadline,
        integrityAck: true,
      })
      .returning();
    createdProjectIds.push(proj.id);

    const storageKey = generatePaymentProofKey(proj.id, "ADVANCE", ".png");
    registerMockFile(storageKey, 2048, "image/png");

    // 2. Client submits proof after deadline
    const proofReq = new Request("http://localhost:3000/api/payments/proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: proj.id,
        transactionReference: "LATE-TXN-PROOF-01",
        storageKey,
        fileType: "image/png",
        fileSize: 2048,
      }),
    });

    const proofRes = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => submitProofRoute(proofReq)
    );

    expect(proofRes.status).toBe(200);
    const proofBody = await proofRes.json();
    expect(proofBody.isLate).toBe(true);

    // 3. Confirm payment status is LATE_PAYMENT_PROOF
    const [paymentRow] = await db
      .select()
      .from(payments)
      .where(eq(payments.projectId, proj.id))
      .limit(1);

    expect(paymentRow).toBeDefined();
    expect(paymentRow.status).toBe("LATE_PAYMENT_PROOF");

    // 4. Confirm project status strictly remains AWAITING_ADVANCE (did NOT auto-progress to ADVANCE_VERIFIED or IN_PROGRESS)
    const [projectAfterProof] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, proj.id))
      .limit(1);

    expect(projectAfterProof.status).toBe("AWAITING_ADVANCE");
    expect(projectAfterProof.status).not.toBe("ADVANCE_VERIFIED");
    expect(projectAfterProof.status).not.toBe("IN_PROGRESS");
    expect(projectAfterProof.developmentDeadline).toBeNull();

    // 5. Require explicit admin action for activation
    const adminVerifyReq = new Request(
      `http://localhost:3000/api/admin/payments/${paymentRow.id}/verify`,
      { method: "POST" }
    );

    const adminRes = await testRequestContext.run(
      { cookie: `buildmate_session=${adminUser.rawToken}` },
      () => verifyPaymentRoute(adminVerifyReq, { params: Promise.resolve({ id: paymentRow.id }) })
    );

    expect(adminRes.status).toBe(200);
    const adminBody = await adminRes.json();
    expect(adminBody.success).toBe(true);
    expect(adminBody.projectStatus).toBe("IN_PROGRESS");

    // 6. Project is only now IN_PROGRESS after explicit admin adjudication
    const [projectAfterAdmin] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, proj.id))
      .limit(1);

    expect(projectAfterAdmin.status).toBe("IN_PROGRESS");
    expect(projectAfterAdmin.developmentDeadline).not.toBeNull();
  });

  /**
   * Additional Comprehensive Invariant Verification:
   * End-to-End integrity_ack enforcement and Centralized Authorization Matrix
   */
  it("test_integrity_ack_enforced_end_to_end", async () => {
    // 1. Missing integrity_ack is rejected with 400
    const reqMissing = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Missing Ack Project",
        subject: "Web",
        description: "Valid description",
        techStack: "Node",
        budgetMin: 1000,
        budgetMax: 2000,
      }),
    });
    const resMissing = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => createProjectRoute(reqMissing)
    );
    expect(resMissing.status).toBe(400);

    // 2. Spoofed false integrity_ack is rejected with 400
    const reqFalse = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "False Ack Project",
        subject: "Web",
        description: "Valid description",
        techStack: "Node",
        budgetMin: 1000,
        budgetMax: 2000,
        integrityAck: false,
      }),
    });
    const resFalse = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => createProjectRoute(reqFalse)
    );
    expect(resFalse.status).toBe(400);

    // 3. True integrity_ack is accepted and written with integrityAckAt populated
    const reqValid = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Valid Ack Project",
        subject: "Web",
        description: "Valid description",
        techStack: "Node",
        budgetMin: 1000,
        budgetMax: 2000,
        integrityAck: true,
      }),
    });
    const resValid = await testRequestContext.run(
      { cookie: `buildmate_session=${clientA.rawToken}` },
      () => createProjectRoute(reqValid)
    );
    expect(resValid.status).toBe(201);
    const validData = await resValid.json();
    createdProjectIds.push(validData.project.id);

    const [saved] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, validData.project.id))
      .limit(1);

    expect(saved.integrityAck).toBe(true);
    expect(saved.integrityAckAt).not.toBeNull();
  });

  it("test_authorization_matrix_coverage", () => {
    // Pure verification of the central matrix rules in src/lib/authorization.ts
    const anonymous = null;
    const clientAuth = {
      user: { id: "c1", name: "Client", email: "c@e.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      roles: ["CLIENT" as const],
    };
    const builderAuth = {
      user: { id: "b1", name: "Builder", email: "b@e.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      roles: ["BUILDER" as const],
    };
    const adminAuth = {
      user: { id: "a1", name: "Admin", email: "a@e.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      roles: ["ADMIN" as const],
    };

    // Public actions
    expect(can(anonymous, "AUTH_REGISTER").allowed).toBe(true);
    expect(can(anonymous, "AUTH_LOGIN").allowed).toBe(true);
    expect(can(anonymous, "AUTH_VERIFY_EMAIL").allowed).toBe(true);

    // Anonymous blocked on authenticated actions
    expect(can(anonymous, "PROJECT_CREATE").allowed).toBe(false);
    expect(can(anonymous, "ADMIN_VIEW_DASHBOARD").allowed).toBe(false);

    // Client permissions
    expect(can(clientAuth, "PROJECT_CREATE").allowed).toBe(true);
    expect(can(clientAuth, "PROJECT_LIST_OWN").allowed).toBe(true);
    expect(can(clientAuth, "ADMIN_VIEW_DASHBOARD").allowed).toBe(false);
    expect(can(clientAuth, "PROJECT_ACCEPT").allowed).toBe(false);

    // Builder permissions
    expect(can(builderAuth, "PROJECT_LIST_AVAILABLE").allowed).toBe(true);
    expect(can(builderAuth, "PROJECT_ACCEPT").allowed).toBe(true);
    expect(can(builderAuth, "PROJECT_CREATE").allowed).toBe(false);
    expect(can(builderAuth, "ADMIN_VIEW_DASHBOARD").allowed).toBe(false);

    // Admin permissions
    expect(can(adminAuth, "ADMIN_VIEW_DASHBOARD").allowed).toBe(true);
    expect(can(adminAuth, "ADMIN_VIEW_ALL_PROJECTS").allowed).toBe(true);
    expect(can(adminAuth, "ADMIN_PAYMENT_VERIFY").allowed).toBe(true);
    expect(can(adminAuth, "ADMIN_RESOLVE_DISPUTE").allowed).toBe(true);
    expect(can(adminAuth, "PROJECT_VIEW_OWN", { clientId: "c1" }).allowed).toBe(true);
  });
});
