import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import {
  validateGitHubUrl,
  validateHttpsUrl,
  validateDeliverableSubmission,
} from "@/lib/projects/deliverable-validation";
import { db } from "@/db";
import { users, userRoles, projects, payments, projectStatusHistory } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { POST as verifyPaymentRoute } from "@/app/api/payments/verify/route";

describe("Phase 15 Task 2 — Submission & Razorpay Hardening Tests", () => {
  describe("Deliverable Submission Validation Hardening", () => {
    it("strictly allows only github.com and raw.githubusercontent.com with https scheme", () => {
      // Valid URLs
      expect(validateGitHubUrl("https://github.com/owner/repo").valid).toBe(true);
      expect(validateGitHubUrl("https://raw.githubusercontent.com/owner/repo").valid).toBe(true);

      // Insecure HTTP scheme
      const httpRes = validateGitHubUrl("http://github.com/owner/repo");
      expect(httpRes.valid).toBe(false);
      expect(httpRes.error).toMatch(/must use the secure https:\/\/ protocol/i);

      // Subdomain spoofing attempts (e.g. evil.github.com.attacker.net)
      const spoof1 = validateGitHubUrl("https://evil.github.com.attacker.net/owner/repo");
      expect(spoof1.valid).toBe(false);
      expect(spoof1.error).toMatch(/must point to github\.com or raw\.githubusercontent\.com/i);

      // Suffix bypass attempts
      const spoof2 = validateGitHubUrl("https://github.com.attacker.com/owner/repo");
      expect(spoof2.valid).toBe(false);

      // Unauthorized subdomain of github
      const spoof3 = validateGitHubUrl("https://evil.github.com/owner/repo");
      expect(spoof3.valid).toBe(false);

      // javascript: pseudo-protocol
      const xssRes = validateGitHubUrl("javascript:alert(1)");
      expect(xssRes.valid).toBe(false);
    });

    it("enforces length caps on all submission fields", () => {
      const longUrl = "https://github.com/owner/" + "a".repeat(2050);
      const urlRes = validateGitHubUrl(longUrl);
      expect(urlRes.valid).toBe(false);
      expect(urlRes.error).toMatch(/must not exceed 2048 characters/i);

      const httpsRes = validateHttpsUrl("https://example.com/" + "b".repeat(2050), "documentationUrl");
      expect(httpsRes.valid).toBe(false);
      expect(httpsRes.error).toMatch(/must not exceed 2048 characters/i);

      const baseValidPayload = {
        githubUrl: "https://github.com/owner/repo",
        repoType: "public",
        branch: "main",
        commitRef: "a1b2c3d4",
        description: "Valid description longer than 10 characters",
        implementedFeatures: "Valid features longer than 10 characters",
      };

      // Branch > 100
      const bRes = validateDeliverableSubmission({
        ...baseValidPayload,
        branch: "b".repeat(101),
      });
      expect(bRes.valid).toBe(false);
      expect(bRes.error).toMatch(/branch is required and must be between 1 and 100 characters/i);

      // CommitRef > 100
      const cRes = validateDeliverableSubmission({
        ...baseValidPayload,
        commitRef: "c".repeat(101),
      });
      expect(cRes.valid).toBe(false);
      expect(cRes.error).toMatch(/commitRef is required and must be between 1 and 100 characters/i);

      // Description > 5000
      const descRes = validateDeliverableSubmission({
        ...baseValidPayload,
        description: "d".repeat(5001),
      });
      expect(descRes.valid).toBe(false);
      expect(descRes.error).toMatch(/description is required and must be between 10 and 5000 characters/i);

      // ImplementedFeatures > 5000
      const featRes = validateDeliverableSubmission({
        ...baseValidPayload,
        implementedFeatures: "f".repeat(5001),
      });
      expect(featRes.valid).toBe(false);
      expect(featRes.error).toMatch(/implementedFeatures is required and must be between 10 and 5000 characters/i);

      // Screenshot URL > 2048
      const ssRes = validateDeliverableSubmission({
        ...baseValidPayload,
        screenshots: ["https://example.com/" + "s".repeat(2050)],
      });
      expect(ssRes.valid).toBe(false);
      expect(ssRes.error).toMatch(/under 2048 characters/i);
    });
  });

  describe("Razorpay Verification Hardening", () => {
    const testRunId = `p15_rzp_${Date.now()}`;
    const createdUserIds: string[] = [];
    const createdProjectIds: string[] = [];

    let clientUser: { id: string; rawToken: string };
    let builderUser: { id: string; rawToken: string };

    beforeAll(async () => {
      const dummyHash = await hashPassword("ValidPassword123!");

      const [c] = await db
        .insert(users)
        .values({
          name: "P15 RZP Client",
          email: `p15_client_${testRunId}@buildmate.test`,
          passwordHash: dummyHash,
        })
        .returning();
      createdUserIds.push(c.id);
      await db.insert(userRoles).values({ userId: c.id, role: "CLIENT" });
      const cSess = await createSession(c.id);
      clientUser = { id: c.id, rawToken: cSess.rawToken };

      const [b] = await db
        .insert(users)
        .values({
          name: "P15 RZP Builder",
          email: `p15_builder_${testRunId}@buildmate.test`,
          passwordHash: dummyHash,
        })
        .returning();
      createdUserIds.push(b.id);
      await db.insert(userRoles).values({ userId: b.id, role: "BUILDER" });
      const bSess = await createSession(b.id);
      builderUser = { id: b.id, rawToken: bSess.rawToken };
    });

    afterAll(async () => {
      if (createdProjectIds.length > 0) {
        await db.delete(payments).where(inArray(payments.projectId, createdProjectIds));
        await db.delete(projectStatusHistory).where(inArray(projectStatusHistory.projectId, createdProjectIds));
        await db.delete(projects).where(inArray(projects.id, createdProjectIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
    });

    it("timingSafeEqual safely rejects mismatched length signatures without throwing uncaught buffer errors", async () => {
      const [proj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-P15-${Date.now().toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "Timing Safe Signature Test",
          subject: "Crypto Verification",
          description: "Testing buffer comparison safety",
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

      const testOrderId = `order_buf_test_${Date.now()}`;
      await db.insert(payments).values({
        projectId: proj.id,
        type: "ADVANCE",
        expectedAmount: 18000,
        status: "ORDER_CREATED",
        razorpayOrderId: testOrderId,
      });

      // Signature with completely odd/truncated hex length (e.g. 10 chars vs 64 chars)
      const req = new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: testOrderId,
          razorpay_payment_id: "pay_short_123",
          razorpay_signature: "1234abcd",
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${clientUser.rawToken}` },
        () => verifyPaymentRoute(req)
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/invalid payment signature/i);
    });

    it("rejects verification if server-to-server order amount cross-check fails", async () => {
      const [proj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-P15-${(Date.now() + 1).toString().slice(-4)}`,
          clientId: clientUser.id,
          builderId: builderUser.id,
          title: "Gateway Cross Check Mismatch Test",
          subject: "Payment Security",
          description: "Testing server-to-server gateway order verification",
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

      // Trigger test mock mismatch via "mismatch_amount" in order ID
      const testOrderId = `order_mismatch_amount_${Date.now()}`;
      const testPaymentId = `pay_valid_${Date.now()}`;

      await db.insert(payments).values({
        projectId: proj.id,
        type: "ADVANCE",
        expectedAmount: 24000,
        status: "ORDER_CREATED",
        razorpayOrderId: testOrderId,
      });

      const secret = process.env.RAZORPAY_KEY_SECRET || "WS38UDS4D5ALgaejV4Ew9YbJ";
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

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/gateway amount or status discrepancy/i);

      // Payment row must be recorded as REJECTED in database
      const [paymentRow] = await db
        .select()
        .from(payments)
        .where(eq(payments.razorpayOrderId, testOrderId))
        .limit(1);

      expect(paymentRow.status).toBe("REJECTED");
    });
  });
});
