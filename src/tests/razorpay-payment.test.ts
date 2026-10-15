import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { db } from "@/db";
import {
  users,
  userRoles,
  sessions,
  projects,
  payments,
  projectStatusHistory,
  notifications,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { POST as createOrderRoute } from "@/app/api/payments/create-order/route";
import { POST as verifyPaymentRoute } from "@/app/api/payments/verify/route";

describe("Phase 14 — Razorpay Standard Web Checkout Integration Tests", () => {
  const testRunId = `rzp_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  let clientUser: { id: string; rawToken: string };
  let unauthorizedClient: { id: string; rawToken: string };
  let builderUser: { id: string; rawToken: string };

  beforeAll(async () => {
    // 1. Create client user
    const [cUser] = await db
      .insert(users)
      .values({
        name: "Razorpay Test Client",
        email: `client_${testRunId}@buildmate.test`,
        passwordHash: await hashPassword("ValidPassword123!"),
        phone: "+919876543210",
      })
      .returning();
    createdUserIds.push(cUser.id);
    await db.insert(userRoles).values({ userId: cUser.id, role: "CLIENT" });
    const cSession = await createSession(cUser.id);
    clientUser = { id: cUser.id, rawToken: cSession.rawToken };

    // 2. Create unauthorized client user
    const [otherUser] = await db
      .insert(users)
      .values({
        name: "Other Client",
        email: `other_${testRunId}@buildmate.test`,
        passwordHash: await hashPassword("ValidPassword123!"),
        phone: "+919876543211",
      })
      .returning();
    createdUserIds.push(otherUser.id);
    await db.insert(userRoles).values({ userId: otherUser.id, role: "CLIENT" });
    const otherSession = await createSession(otherUser.id);
    unauthorizedClient = { id: otherUser.id, rawToken: otherSession.rawToken };

    // 3. Create builder user
    const [bUser] = await db
      .insert(users)
      .values({
        name: "Razorpay Test Builder",
        email: `builder_${testRunId}@buildmate.test`,
        passwordHash: await hashPassword("ValidPassword123!"),
        phone: "+919876543212",
      })
      .returning();
    createdUserIds.push(bUser.id);
    await db.insert(userRoles).values({ userId: bUser.id, role: "BUILDER" });
    const bSession = await createSession(bUser.id);
    builderUser = { id: bUser.id, rawToken: bSession.rawToken };
  });

  afterAll(async () => {
    if (createdProjectIds.length > 0) {
      await db.delete(projectStatusHistory).where(inArray(projectStatusHistory.projectId, createdProjectIds));
      await db.delete(payments).where(inArray(payments.projectId, createdProjectIds));
      await db.delete(projects).where(inArray(projects.id, createdProjectIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("1. create-order requires authentication", async () => {
    const req = new Request("http://localhost:3000/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "00000000-0000-0000-0000-000000000001" }),
    });

    const res = await createOrderRoute(req);
    expect(res.status).toBe(401);
  });

  it("2. create-order rejects unauthorized callers who do not own the project", async () => {
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-RZP-${Date.now().toString().slice(-4)}`,
        clientId: clientUser.id,
        builderId: builderUser.id,
        title: "Client Ownership Test",
        subject: "Web Dev",
        description: "Testing client scoping",
        techStack: "Next.js",
        budgetMin: 30000,
        budgetMax: 60000,
        totalPrice: 60000,
        advanceAmount: 18000,
        remainingAmount: 42000,
        status: "AWAITING_ADVANCE",
      })
      .returning();
    createdProjectIds.push(proj.id);

    const req = new Request("http://localhost:3000/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: proj.id }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${unauthorizedClient.rawToken}` },
      () => createOrderRoute(req)
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  it("3. create-order rejects project not awaiting payment", async () => {
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-RZP-${(Date.now() + 1).toString().slice(-4)}`,
        clientId: clientUser.id,
        builderId: builderUser.id,
        title: "Not Awaiting Payment Test",
        subject: "Web Dev",
        description: "Testing state validation",
        techStack: "Next.js",
        budgetMin: 30000,
        budgetMax: 60000,
        totalPrice: 60000,
        advanceAmount: 18000,
        remainingAmount: 42000,
        status: "IN_PROGRESS",
      })
      .returning();
    createdProjectIds.push(proj.id);

    const req = new Request("http://localhost:3000/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: proj.id }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientUser.rawToken}` },
      () => createOrderRoute(req)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not currently awaiting payment");
  });

  it("4. create-order derives amount server-side (ignores client-supplied amount) and creates Razorpay order", async () => {
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-RZP-${(Date.now() + 2).toString().slice(-4)}`,
        clientId: clientUser.id,
        builderId: builderUser.id,
        title: "Server Derived Order Amount",
        subject: "Web Dev",
        description: "Testing server-derived amount",
        techStack: "Next.js",
        budgetMin: 50000,
        budgetMax: 100000,
        totalPrice: 100000,
        advanceAmount: 30000,
        remainingAmount: 70000,
        status: "AWAITING_ADVANCE",
      })
      .returning();
    createdProjectIds.push(proj.id);

    // Client maliciously passes amount: 1
    const req = new Request("http://localhost:3000/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: proj.id, amount: 1, expectedAmount: 1 }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientUser.rawToken}` },
      () => createOrderRoute(req)
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    // 30000 INR = 3000000 paise
    expect(body.amount).toBe(3000000);
    expect(body.currency).toBe("INR");
    expect(body.order_id).toBeDefined();
    expect(body.key_id).toBeDefined();

    // Assert stored payment row
    const [storedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.projectId, proj.id))
      .limit(1);

    expect(storedPayment).toBeDefined();
    expect(storedPayment.expectedAmount).toBe(30000);
    expect(storedPayment.type).toBe("ADVANCE");
    expect(storedPayment.status).toBe("ORDER_CREATED");
    expect(storedPayment.razorpayOrderId).toBe(body.order_id);
  });

  it("5. verify endpoint rejects missing signature parameters", async () => {
    const req = new Request("http://localhost:3000/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: "order_12345",
        // missing razorpay_payment_id and razorpay_signature
      }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientUser.rawToken}` },
      () => verifyPaymentRoute(req)
    );

    expect(res.status).toBe(400);
  });

  it("6. verify endpoint rejects invalid HMAC signature, sets payment to REJECTED, and does not alter project status", async () => {
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-RZP-${(Date.now() + 3).toString().slice(-4)}`,
        clientId: clientUser.id,
        builderId: builderUser.id,
        title: "Tampered Signature Test",
        subject: "Web Dev",
        description: "Testing signature forgery rejection",
        techStack: "Next.js",
        budgetMin: 40000,
        budgetMax: 80000,
        totalPrice: 80000,
        advanceAmount: 24000,
        remainingAmount: 56000,
        status: "AWAITING_ADVANCE",
      })
      .returning();
    createdProjectIds.push(proj.id);

    const testOrderId = `order_fake_${Date.now()}`;
    await db.insert(payments).values({
      projectId: proj.id,
      type: "ADVANCE",
      expectedAmount: 24000,
      status: "ORDER_CREATED",
      razorpayOrderId: testOrderId,
    });

    // Send forged signature
    const req = new Request("http://localhost:3000/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: testOrderId,
        razorpay_payment_id: "pay_fake_123456",
        razorpay_signature: "deadbeef0000111122223333444455556666777788889999aaaabbbbccccdddd",
      }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientUser.rawToken}` },
      () => verifyPaymentRoute(req)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);

    // Assert payment row is REJECTED
    const [pRow] = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, testOrderId))
      .limit(1);

    expect(pRow.status).toBe("REJECTED");

    // Assert project status was NOT advanced
    const [projAfter] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, proj.id))
      .limit(1);

    expect(projAfter.status).toBe("AWAITING_ADVANCE");
    expect(projAfter.developmentDeadline).toBeNull();
  });

  it("7. verify endpoint succeeds with valid HMAC, sets VERIFIED, and advances status to IN_PROGRESS for ADVANCE payment", async () => {
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-RZP-${(Date.now() + 4).toString().slice(-4)}`,
        clientId: clientUser.id,
        builderId: builderUser.id,
        title: "Valid Advance Verification",
        subject: "Web Dev",
        description: "Testing valid advance payment",
        techStack: "Next.js",
        budgetMin: 50000,
        budgetMax: 100000,
        totalPrice: 100000,
        advanceAmount: 30000,
        remainingAmount: 70000,
        status: "AWAITING_ADVANCE",
      })
      .returning();
    createdProjectIds.push(proj.id);

    const testOrderId = `order_valid_${Date.now()}`;
    const testPaymentId = `pay_valid_${Date.now()}`;

    await db.insert(payments).values({
      projectId: proj.id,
      type: "ADVANCE",
      expectedAmount: 30000,
      status: "ORDER_CREATED",
      razorpayOrderId: testOrderId,
    });

    // Compute authentic signature using configured RAZORPAY_KEY_SECRET
    const secret = process.env.RAZORPAY_KEY_SECRET || "IOwgSYU19bkWaE8JWM20xwlm";
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest("hex");

    const req = new Request("http://localhost:3000/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: testOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: validSignature,
      }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientUser.rawToken}` },
      () => verifyPaymentRoute(req)
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.new_status).toBe("IN_PROGRESS");

    // Assert payment row is VERIFIED with payment ID and verifiedAt
    const [pRow] = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, testOrderId))
      .limit(1);

    expect(pRow.status).toBe("VERIFIED");
    expect(pRow.razorpayPaymentId).toBe(testPaymentId);
    expect(pRow.verifiedAt).not.toBeNull();

    // Assert project is IN_PROGRESS with development started and deadline set
    const [projAfter] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, proj.id))
      .limit(1);

    expect(projAfter.status).toBe("IN_PROGRESS");
    expect(projAfter.developmentStartedAt).not.toBeNull();
    expect(projAfter.developmentDeadline).not.toBeNull();
  });

  it("8. verify endpoint succeeds for FINAL payment and transitions project to DELIVERY_UNLOCKED", async () => {
    const [proj] = await db
      .insert(projects)
      .values({
        projectCode: `PRJ-RZP-${(Date.now() + 5).toString().slice(-4)}`,
        clientId: clientUser.id,
        builderId: builderUser.id,
        title: "Valid Final Verification",
        subject: "Web Dev",
        description: "Testing valid final payment",
        techStack: "Next.js",
        budgetMin: 50000,
        budgetMax: 100000,
        totalPrice: 100000,
        advanceAmount: 30000,
        remainingAmount: 70000,
        status: "FINAL_PAYMENT_PENDING",
      })
      .returning();
    createdProjectIds.push(proj.id);

    const testOrderId = `order_final_${Date.now()}`;
    const testPaymentId = `pay_final_${Date.now()}`;

    await db.insert(payments).values({
      projectId: proj.id,
      type: "FINAL",
      expectedAmount: 70000,
      status: "ORDER_CREATED",
      razorpayOrderId: testOrderId,
    });

    const secret = process.env.RAZORPAY_KEY_SECRET || "IOwgSYU19bkWaE8JWM20xwlm";
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest("hex");

    const req = new Request("http://localhost:3000/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: testOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: validSignature,
      }),
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${clientUser.rawToken}` },
      () => verifyPaymentRoute(req)
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.new_status).toBe("DELIVERY_UNLOCKED");

    const [projAfter] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, proj.id))
      .limit(1);

    expect(projAfter.status).toBe("DELIVERY_UNLOCKED");
  });
});
