import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import {
  getUploadUrl,
  getDownloadUrl,
  verifyStorageObjectExists,
  isR2Configured,
  StorageConfigurationError,
} from "@/lib/storage";
import { POST as presignedUrlRoute } from "@/app/api/payments/presigned-url/route";
import { POST as proofRoute } from "@/app/api/payments/proof/route";
import { GET as getPaymentRoute } from "@/app/api/payments/[id]/route";
import { db } from "@/db";
import { users, userRoles, projects, payments, paymentProofs, sessions } from "@/db/schema";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { inArray } from "drizzle-orm";

describe("Cloudflare R2 Storage Hardening & Graceful Failure Verification", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("1. Production + Missing R2 Configuration", () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
    });

    it("isR2Configured returns false when R2 env vars are missing", () => {
      expect(isR2Configured()).toBe(false);
    });

    it("getUploadUrl throws StorageConfigurationError with status 503", async () => {
      await expect(
        getUploadUrl("proofs/test-project/advance/sample.png", "image/png", 300)
      ).rejects.toThrowError(StorageConfigurationError);

      try {
        await getUploadUrl("proofs/test-project/advance/sample.png", "image/png", 300);
      } catch (err: any) {
        expect(err.status).toBe(503);
        expect(err.message).toContain("Cloudflare R2 storage is not configured");
        // Ensure no secrets leaked in error
        expect(err.message).not.toContain("secret");
        expect(err.message).not.toContain("key");
      }
    });

    it("getDownloadUrl throws StorageConfigurationError with status 503", async () => {
      await expect(
        getDownloadUrl("proofs/test-project/advance/sample.png", 60)
      ).rejects.toThrowError(StorageConfigurationError);

      try {
        await getDownloadUrl("proofs/test-project/advance/sample.png", 60);
      } catch (err: any) {
        expect(err.status).toBe(503);
        expect(err.message).toContain("Cloudflare R2 storage is not configured");
      }
    });

    it("verifyStorageObjectExists throws StorageConfigurationError with status 503", async () => {
      await expect(
        verifyStorageObjectExists("proofs/test-project/advance/sample.png")
      ).rejects.toThrowError(StorageConfigurationError);

      try {
        await verifyStorageObjectExists("proofs/test-project/advance/sample.png");
      } catch (err: any) {
        expect(err.status).toBe(503);
        expect(err.message).toContain("Cloudflare R2 storage is not configured");
      }
    });
  });

  describe("2. Production + Valid R2 Configuration", () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = "production";
      process.env.R2_ACCOUNT_ID = "mock-account-12345";
      process.env.R2_ACCESS_KEY_ID = "mock-access-key-67890";
      process.env.R2_SECRET_ACCESS_KEY = "mock-secret-access-key-abcdef";
      process.env.R2_BUCKET_NAME = "buildmate-proofs";
    });

    it("isR2Configured returns true when all 4 variables are present", () => {
      expect(isR2Configured()).toBe(true);
    });

    it("getUploadUrl generates signed URL targeting R2 bucket", async () => {
      const uploadUrl = await getUploadUrl(
        "proofs/prj-123/advance/mock-key.png",
        "image/png",
        300
      );
      expect(uploadUrl).toBeDefined();
      expect(typeof uploadUrl).toBe("string");
      expect(uploadUrl).toContain("r2.cloudflarestorage.com");
      expect(uploadUrl).toContain("buildmate-proofs");
      expect(uploadUrl).toContain("X-Amz-Signature");
      expect(uploadUrl).toContain("X-Amz-Expires=300");
    });

    it("getDownloadUrl generates short-lived signed GET URL (60s TTL)", async () => {
      const downloadUrl = await getDownloadUrl(
        "proofs/prj-123/advance/mock-key.png",
        60
      );
      expect(downloadUrl).toBeDefined();
      expect(typeof downloadUrl).toBe("string");
      expect(downloadUrl).toContain("r2.cloudflarestorage.com");
      expect(downloadUrl).toContain("buildmate-proofs");
      expect(downloadUrl).toContain("X-Amz-Signature");
      expect(downloadUrl).toContain("X-Amz-Expires=60");
    });
  });

  describe("3. Development Environment Behavior", () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = "development";
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      process.env.SESSION_SECRET = "dev-secret-for-testing-123456789";
    });

    it("getUploadUrl generates local HMAC signed fallback URL in development", async () => {
      const url = await getUploadUrl("proofs/prj-dev/advance/file.png", "image/png", 300);
      expect(url).toContain("/api/files/upload?key=");
      expect(url).toContain("&sig=");
      expect(url).toContain("&expires=");
    });

    it("getDownloadUrl generates local HMAC signed fallback URL in development", async () => {
      const url = await getDownloadUrl("proofs/prj-dev/advance/file.png", 60);
      expect(url).toContain("/api/files/download?key=");
      expect(url).toContain("&sig=");
      expect(url).toContain("&expires=");
    });
  });

  describe("4. Route-Level Controlled Error Handling in Production", () => {
    let testUserId: string;
    let testProjectId: string;
    let testPaymentId: string;
    let userToken: string;

    beforeAll(async () => {
      const [u] = await db
        .insert(users)
        .values({
          name: "Storage Route Test User",
          email: `storage_test_${Date.now()}@example.com`,
          passwordHash: "hash",
          emailVerified: true,
        })
        .returning();
      testUserId = u.id;
      await db.insert(userRoles).values({ userId: u.id, role: "CLIENT" });
      const sess = await createSession(u.id);
      userToken = sess.rawToken;

      const [p] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-STG-${Date.now().toString().slice(-4)}`,
          clientId: u.id,
          title: "Storage Route Test Project",
          subject: "Test",
          description: "Test description",
          budgetMin: 10000,
          budgetMax: 20000,
          totalPrice: 20000,
          advanceAmount: 10000,
          remainingAmount: 10000,
          status: "AWAITING_ADVANCE",
          integrityAck: true,
        })
        .returning();
      testProjectId = p.id;

      const [pay] = await db
        .insert(payments)
        .values({
          projectId: p.id,
          type: "ADVANCE",
          expectedAmount: 10000,
          status: "PROOF_SUBMITTED",
        })
        .returning();
      testPaymentId = pay.id;

      await db.insert(paymentProofs).values({
        paymentId: pay.id,
        fileUrl: `proofs/${p.id}/advance/sample.png`,
        fileType: "image/png",
        fileSize: 1024,
      });
    });

    afterAll(async () => {
      if (testPaymentId) {
        await db.delete(paymentProofs);
        await db.delete(payments).where(inArray(payments.id, [testPaymentId]));
      }
      if (testProjectId) {
        await db.delete(projects).where(inArray(projects.id, [testProjectId]));
      }
      if (testUserId) {
        await db.delete(sessions).where(inArray(sessions.userId, [testUserId]));
        await db.delete(userRoles).where(inArray(userRoles.userId, [testUserId]));
        await db.delete(users).where(inArray(users.id, [testUserId]));
      }
    });

    beforeEach(() => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
    });

    it("POST /api/payments/presigned-url returns HTTP 503 when R2 is unconfigured in production", async () => {
      const req = new Request("http://localhost:3000/api/payments/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: testProjectId,
          extension: ".png",
          mimeType: "image/png",
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userToken}` },
        () => presignedUrlRoute(req)
      );

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain("Cloudflare R2 storage is not configured");
      expect(JSON.stringify(data)).not.toContain("secret");
      expect(JSON.stringify(data)).not.toContain("key");
    });

    it("POST /api/payments/proof returns HTTP 503 when R2 is unconfigured in production", async () => {
      const req = new Request("http://localhost:3000/api/payments/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: testProjectId,
          transactionReference: "TXN12345678",
          storageKey: `proofs/${testProjectId}/advance/random-uuid.png`,
          fileType: "image/png",
          fileSize: 1024,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userToken}` },
        () => proofRoute(req)
      );

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain("Cloudflare R2 storage is not configured");
    });

    it("GET /api/payments/[id] returns HTTP 200 with downloadUrl: null rather than crashing with 500", async () => {
      const req = new Request(`http://localhost:3000/api/payments/${testPaymentId}`, {
        method: "GET",
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userToken}` },
        () => getPaymentRoute(req, { params: Promise.resolve({ id: testPaymentId }) })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.payment.id).toBe(testPaymentId);
      expect(data.proofs).toHaveLength(1);
      expect(data.proofs[0].downloadUrl).toBeNull();
    });

    it("Unauthenticated request to presigned-url returns HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/payments/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: testProjectId,
          extension: ".png",
        }),
      });

      const res = await presignedUrlRoute(req);
      expect(res.status).toBe(401);
    });
  });
});
