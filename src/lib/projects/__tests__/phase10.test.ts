import assert from "node:assert";
import { db } from "../../../db";
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
} from "../../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { createSession, testRequestContext } from "../../auth/session";
import { hashPassword } from "../../auth/password";
import { registerMockFile, clearMockStorage, generatePaymentProofKey } from "../../storage";
import { can } from "../../authorization";

// Real application routes under test
import { POST as registerRoute } from "../../../app/api/auth/register/route";
import { POST as createProjectRoute } from "../../../app/api/projects/route";
import { GET as getProjectRoute } from "../../../app/api/projects/[id]/route";
import { POST as submitProofRoute } from "../../../app/api/payments/proof/route";
import { GET as getPaymentRoute } from "../../../app/api/payments/[id]/route";
import { GET as getDeliveryRoute } from "../../../app/api/projects/[id]/delivery/route";
import { POST as verifyPaymentRoute } from "../../../app/api/admin/payments/[id]/verify/route";

async function runPhase10Tests() {
  console.log("=================================================");
  console.log("  BUILDMATE PHASE 10 SECURITY HARDENING & TESTS  ");
  console.log("=================================================");

  const testRunId = `phase10_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

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
  const clientA = { id: uA.id, rawToken: sessA.rawToken };
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
  const clientB = { id: uB.id, rawToken: sessB.rawToken };
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
  const builderUser = { id: uBuilder.id, rawToken: sessBuilder.rawToken };
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
  const adminUser = { id: uAdmin.id, rawToken: sessAdmin.rawToken };
  createdUserIds.push(uAdmin.id);

  try {
    // 1. test_payment_amount_cannot_be_client_modified
    console.log("\n1. Running test_payment_amount_cannot_be_client_modified...");
    {
      const [proj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-P10-${Date.now().toString().slice(-4)}`,
          clientId: clientA.id,
          builderId: builderUser.id,
          title: "P10 Test Project 1",
          subject: "Security",
          description: "Testing amount manipulation",
          techStack: "PostgreSQL",
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

      const attackPayload = {
        projectId: proj.id,
        transactionReference: "TXN-ATTACK-001",
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

      assert.strictEqual(res.status, 200);
      const [stored] = await db
        .select()
        .from(payments)
        .where(eq(payments.projectId, proj.id))
        .limit(1);

      assert.strictEqual(stored.expectedAmount, 50000);
      assert.strictEqual(stored.submittedAmount, null);
      console.log("  ✓ test_payment_amount_cannot_be_client_modified passed");
    }

    // 2. test_delivery_locked_until_final_payment_verified
    console.log("\n2. Running test_delivery_locked_until_final_payment_verified...");
    {
      const [proj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-P10-${(Date.now() + 1).toString().slice(-4)}`,
          clientId: clientA.id,
          builderId: builderUser.id,
          title: "P10 Test Project 2",
          subject: "Delivery",
          description: "Delivery locked verification",
          techStack: "React",
          budgetMin: 30000,
          budgetMax: 60000,
          advanceAmount: 30000,
          remainingAmount: 30000,
          status: "FINAL_PAYMENT_PROOF_SUBMITTED",
          integrityAck: true,
        })
        .returning();
      createdProjectIds.push(proj.id);

      await db.insert(deliverables).values({
        projectId: proj.id,
        builderId: builderUser.id,
        githubUrl: "https://github.com/secret-org/deliverable-code",
        repoType: "PUBLIC",
        branch: "main",
        commitRef: "c0ffee",
        description: "Confidential code",
        implementedFeatures: "All features",
        deploymentUrl: "https://confidential-delivery.vercel.app",
      });

      await db.insert(payments).values({
        projectId: proj.id,
        type: "ADVANCE",
        expectedAmount: 30000,
        transactionReference: "ADV-TX",
        status: "VERIFIED",
      });

      await db.insert(payments).values({
        projectId: proj.id,
        type: "FINAL",
        expectedAmount: 30000,
        transactionReference: "FINAL-TX",
        status: "PROOF_SUBMITTED",
      });

      const req = new Request(`http://localhost:3000/api/projects/${proj.id}/delivery`);
      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${clientA.rawToken}` },
        () => getDeliveryRoute(req, { params: Promise.resolve({ id: proj.id }) })
      );

      assert.strictEqual(res.status, 403);
      const rawText = await res.text();
      assert.ok(rawText.includes('"locked":true'));
      assert.ok(!rawText.includes("github_url"));
      assert.ok(!rawText.includes("deliverable-code"));
      assert.ok(!rawText.includes("confidential-delivery.vercel.app"));
      console.log("  ✓ test_delivery_locked_until_final_payment_verified passed");
    }

    // 3. test_client_cannot_access_other_clients_project
    console.log("\n3. Running test_client_cannot_access_other_clients_project...");
    {
      const [projB] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-P10-${(Date.now() + 2).toString().slice(-4)}`,
          clientId: clientB.id,
          title: "Client B Confidential Project",
          subject: "Secret",
          description: "Classified",
          techStack: "Python",
          budgetMin: 50000,
          budgetMax: 100000,
          status: "DRAFT",
          integrityAck: true,
        })
        .returning();
      createdProjectIds.push(projB.id);

      const reqA = new Request(`http://localhost:3000/api/projects/${projB.id}`);
      const resA = await testRequestContext.run(
        { cookie: `buildmate_session=${clientA.rawToken}` },
        () => getProjectRoute(reqA, { params: Promise.resolve({ id: projB.id }) })
      );

      assert.strictEqual(resA.status, 403);
      const bodyA = await resA.json();
      assert.ok("error" in bodyA);
      assert.strictEqual(JSON.stringify(bodyA).includes("Client B Confidential Project"), false);

      // Check nonexistent ID shape
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const reqFake = new Request(`http://localhost:3000/api/projects/${fakeId}`);
      const resFake = await testRequestContext.run(
        { cookie: `buildmate_session=${clientA.rawToken}` },
        () => getProjectRoute(reqFake, { params: Promise.resolve({ id: fakeId }) })
      );
      assert.strictEqual(resFake.status, 404);
      const bodyFake = await resFake.json();
      assert.deepStrictEqual(Object.keys(bodyA), Object.keys(bodyFake));
      console.log("  ✓ test_client_cannot_access_other_clients_project passed");
    }

    // 4. test_client_cannot_access_other_clients_payment_proof
    console.log("\n4. Running test_client_cannot_access_other_clients_payment_proof...");
    {
      const [projB] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-P10-${(Date.now() + 3).toString().slice(-4)}`,
          clientId: clientB.id,
          title: "Client B Bank Details",
          subject: "Banking",
          description: "Private",
          techStack: "Java",
          budgetMin: 25000,
          budgetMax: 50000,
          advanceAmount: 25000,
          remainingAmount: 25000,
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
          expectedAmount: 25000,
          transactionReference: "CLIENT-B-RECEIPT-REF",
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

      const req = new Request(`http://localhost:3000/api/payments/${paymentB.id}`);
      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${clientA.rawToken}` },
        () => getPaymentRoute(req, { params: Promise.resolve({ id: paymentB.id }) })
      );

      assert.strictEqual(res.status, 403);
      const rawText = await res.text();
      assert.strictEqual(rawText.includes("downloadUrl"), false);
      assert.strictEqual(rawText.includes(storageKey), false);
      assert.strictEqual(rawText.includes("CLIENT-B-RECEIPT-REF"), false);
      console.log("  ✓ test_client_cannot_access_other_clients_payment_proof passed");
    }

    // 5. test_role_cannot_be_set_via_registration_payload
    console.log("\n5. Running test_role_cannot_be_set_via_registration_payload...");
    {
      const maliciousEmail = `priv_attacker_${Date.now()}@example.com`;
      const payload = {
        name: "Privilege Attacker",
        email: maliciousEmail,
        password: "SuperSecretPassword123!",
        confirmPassword: "SuperSecretPassword123!",
        role: "ADMIN",
        roles: ["ADMIN"],
      };

      const req = new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await registerRoute(req);
      assert.strictEqual(res.status, 201);

      const [created] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, maliciousEmail.toLowerCase()))
        .limit(1);

      assert.ok(created);
      createdUserIds.push(created.id);

      const roles = await db
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, created.id));

      const roleNames = roles.map((r) => r.role);
      assert.deepStrictEqual(roleNames, ["CLIENT"]);
      assert.strictEqual(roleNames.includes("ADMIN"), false);
      console.log("  ✓ test_role_cannot_be_set_via_registration_payload passed");
    }

    // 6. test_server_side_deadline_computation
    console.log("\n6. Running test_server_side_deadline_computation...");
    {
      const spoofedDate = new Date("2035-01-01T00:00:00Z");
      const payload = {
        title: "Clock Spoofing Defense",
        subject: "Security",
        description: "Testing server-side deadline calculation",
        techStack: "Rust",
        budgetMin: 30000,
        budgetMax: 60000,
        integrityAck: true,
        current_time: spoofedDate.toISOString(),
        now: spoofedDate.toISOString(),
        timestamp: spoofedDate.getTime(),
      };

      const req = new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Time": spoofedDate.toISOString(),
          Date: spoofedDate.toUTCString(),
        },
        body: JSON.stringify(payload),
      });

      const beforeCall = Date.now();
      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${clientA.rawToken}` },
        () => createProjectRoute(req)
      );
      const afterCall = Date.now();

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      createdProjectIds.push(data.project.id);

      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, data.project.id))
        .limit(1);

      const actualDeadline = new Date(proj.acceptanceDeadline!).getTime();
      const expectedMin = beforeCall + 48 * 60 * 60 * 1000 - 10000;
      const expectedMax = afterCall + 48 * 60 * 60 * 1000 + 10000;

      assert.ok(actualDeadline >= expectedMin);
      assert.ok(actualDeadline <= expectedMax);
      assert.ok(actualDeadline < spoofedDate.getTime());
      console.log("  ✓ test_server_side_deadline_computation passed");
    }

    // 7. test_expired_advance_window_blocks_activation
    console.log("\n7. Running test_expired_advance_window_blocks_activation...");
    {
      const pastDeadline = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const [proj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-P10-${(Date.now() + 4).toString().slice(-4)}`,
          clientId: clientA.id,
          builderId: builderUser.id,
          title: "Late Payment Block Project",
          subject: "Payments",
          description: "Testing late payment block",
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

      const proofReq = new Request("http://localhost:3000/api/payments/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: proj.id,
          transactionReference: "TXN-LATE-01",
          storageKey,
          fileType: "image/png",
          fileSize: 2048,
        }),
      });

      const proofRes = await testRequestContext.run(
        { cookie: `buildmate_session=${clientA.rawToken}` },
        () => submitProofRoute(proofReq)
      );

      assert.strictEqual(proofRes.status, 200);
      const proofData = await proofRes.json();
      assert.strictEqual(proofData.isLate, true);

      const [paymentRow] = await db
        .select()
        .from(payments)
        .where(eq(payments.projectId, proj.id))
        .limit(1);

      assert.strictEqual(paymentRow.status, "LATE_PAYMENT_PROOF");

      const [projectAfterProof] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, proj.id))
        .limit(1);

      assert.strictEqual(projectAfterProof.status, "AWAITING_ADVANCE");
      assert.strictEqual(projectAfterProof.developmentDeadline, null);

      // Explicit admin verification
      const verifyReq = new Request(
        `http://localhost:3000/api/admin/payments/${paymentRow.id}/verify`,
        { method: "POST" }
      );

      const verifyRes = await testRequestContext.run(
        { cookie: `buildmate_session=${adminUser.rawToken}` },
        () => verifyPaymentRoute(verifyReq, { params: Promise.resolve({ id: paymentRow.id }) })
      );

      assert.strictEqual(verifyRes.status, 200);
      const verifyData = await verifyRes.json();
      assert.strictEqual(verifyData.projectStatus, "IN_PROGRESS");

      const [projectAfterAdmin] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, proj.id))
        .limit(1);

      assert.strictEqual(projectAfterAdmin.status, "IN_PROGRESS");
      assert.ok(projectAfterAdmin.developmentDeadline !== null);
      console.log("  ✓ test_expired_advance_window_blocks_activation passed");
    }

    // 8. End-to-end integrity_ack check
    console.log("\n8. Running test_integrity_ack_enforced_end_to_end...");
    {
      const reqMissing = new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "No Ack",
          subject: "Sub",
          description: "Desc",
          techStack: "Tech",
          budgetMin: 1000,
          budgetMax: 2000,
        }),
      });
      const resMissing = await testRequestContext.run(
        { cookie: `buildmate_session=${clientA.rawToken}` },
        () => createProjectRoute(reqMissing)
      );
      assert.strictEqual(resMissing.status, 400);

      const reqValid = new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Valid Ack",
          subject: "Sub",
          description: "Desc",
          techStack: "Tech",
          budgetMin: 1000,
          budgetMax: 2000,
          integrityAck: true,
        }),
      });
      const resValid = await testRequestContext.run(
        { cookie: `buildmate_session=${clientA.rawToken}` },
        () => createProjectRoute(reqValid)
      );
      assert.strictEqual(resValid.status, 201);
      const validData = await resValid.json();
      createdProjectIds.push(validData.project.id);

      const [saved] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, validData.project.id))
        .limit(1);

      assert.strictEqual(saved.integrityAck, true);
      assert.ok(saved.integrityAckAt !== null);
      console.log("  ✓ test_integrity_ack_enforced_end_to_end passed");
    }

    // 9. Centralized Authorization Matrix
    console.log("\n9. Running authorization matrix coverage...");
    {
      const clientAuth = { user: { id: "c", name: "C", email: "c@e.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() }, roles: ["CLIENT" as const] };
      const builderAuth = { user: { id: "b", name: "B", email: "b@e.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() }, roles: ["BUILDER" as const] };
      const adminAuth = { user: { id: "a", name: "A", email: "a@e.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() }, roles: ["ADMIN" as const] };

      assert.strictEqual(can(clientAuth, "PROJECT_CREATE").allowed, true);
      assert.strictEqual(can(builderAuth, "PROJECT_CREATE").allowed, false);
      assert.strictEqual(can(builderAuth, "PROJECT_LIST_AVAILABLE").allowed, true);
      assert.strictEqual(can(clientAuth, "PROJECT_LIST_AVAILABLE").allowed, false);
      assert.strictEqual(can(adminAuth, "ADMIN_VIEW_DASHBOARD").allowed, true);
      assert.strictEqual(can(clientAuth, "ADMIN_VIEW_DASHBOARD").allowed, false);
      assert.strictEqual(can(adminAuth, "ADMIN_PAYMENT_VERIFY").allowed, true);
      assert.strictEqual(can(builderAuth, "ADMIN_PAYMENT_VERIFY").allowed, false);
      console.log("  ✓ authorization matrix coverage passed");
    }

    console.log("\n=================================================");
    console.log("  ALL 7 NAMED INTEGRATION SECURITY TESTS PASSED! ");
    console.log("=================================================\n");
  } finally {
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
  }
}

runPhase10Tests().catch((err) => {
  console.error("Phase 10 Test Failure:", err);
  process.exit(1);
});
