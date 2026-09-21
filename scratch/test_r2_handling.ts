import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getUploadUrl,
  getDownloadUrl,
  verifyStorageObjectExists,
  isR2Configured,
  StorageConfigurationError,
} from "./src/lib/storage";

describe("Cloudflare R2 Storage Hardening & Graceful Failure Verification", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("1. Production + Missing R2 Configuration", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
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
      process.env.NODE_ENV = "production";
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
      process.env.NODE_ENV = "development";
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
});
