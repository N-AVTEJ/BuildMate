import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import os from "os";

export interface StorageResult {
  storageKey: string;
  fileUrl: string;
}

export interface StorageProvider {
  /**
   * Stores a file buffer under a server-generated storage key.
   * Never relies on client-provided paths.
   */
  upload(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string
  ): Promise<StorageResult>;

  /**
   * Deletes a previously stored file by its server storage key.
   * Used for cleanup and failure rollbacks.
   */
  delete(storageKey: string): Promise<void>;
}

/**
 * Local Storage Provider with Serverless Read-Only Filesystem Fallback.
 *
 * Security Guarantees:
 * 1. Generates an unpredictable UUID storage key. The user's original filename
 *    is never used as the physical file path (eliminating path traversal).
 * 2. Files are stored in a dedicated local directory (`storage/uploads`) that is NOT
 *    configured as an executable or publicly browsable static asset directory.
 * 3. Gracefully falls back to `os.tmpdir()` on read-only serverless filesystems (e.g., Vercel /var/task).
 * 4. Provides clean file deletion to support transactional cleanup on database failure.
 */
export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private fallbackDir: string;

  constructor(customUploadDir?: string) {
    this.uploadDir = customUploadDir || path.join(process.cwd(), "storage", "uploads");
    this.fallbackDir = path.join(os.tmpdir(), "buildmate-uploads");
  }

  private isServerless(): boolean {
    return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  }

  private async ensureDir(): Promise<string> {
    if (this.isServerless()) {
      await fs.mkdir(this.fallbackDir, { recursive: true });
      return this.fallbackDir;
    }
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      return this.uploadDir;
    } catch {
      // In serverless environments (e.g. Vercel), process.cwd() is read-only.
      // Gracefully fall back to os.tmpdir() which is always writable.
      await fs.mkdir(this.fallbackDir, { recursive: true });
      return this.fallbackDir;
    }
  }

  async upload(
    fileBuffer: Buffer,
    originalFilename: string,
    _mimeType: string
  ): Promise<StorageResult> {
    const activeDir = await this.ensureDir();

    // Extract safe extension
    const extMatch = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";

    // Generate random UUID key (unpredictable and path-traversal free)
    const storageKey = `${crypto.randomUUID()}${ext}`;
    let targetFilePath = path.join(activeDir, storageKey);

    // Write file to disk (try activeDir, fallback to fallbackDir if write fails)
    try {
      await fs.writeFile(targetFilePath, fileBuffer);
    } catch {
      await fs.mkdir(this.fallbackDir, { recursive: true });
      targetFilePath = path.join(this.fallbackDir, storageKey);
      await fs.writeFile(targetFilePath, fileBuffer);
    }

    // Return reference URL
    const fileUrl = `/api/files/${encodeURIComponent(storageKey)}`;

    return {
      storageKey,
      fileUrl,
    };
  }

  async delete(storageKey: string): Promise<void> {
    // Sanitize key before unlinking to prevent path traversal
    const safeKey = path.basename(storageKey);
    const targetFilePath = path.join(this.uploadDir, safeKey);
    const fallbackPath = path.join(this.fallbackDir, safeKey);

    try {
      await fs.unlink(targetFilePath);
    } catch {
      // Try fallback directory
      try {
        await fs.unlink(fallbackPath);
      } catch {
        // File may already be absent
      }
    }
  }
}

/**
 * Hybrid Storage Provider:
 * Automatically uses Cloudflare R2 if configured in the environment;
 * otherwise gracefully falls back to LocalStorageProvider with serverless tmp safety.
 */
export class HybridStorageProvider implements StorageProvider {
  private localProvider: LocalStorageProvider;

  constructor() {
    this.localProvider = new LocalStorageProvider();
  }

  private isR2Configured(): boolean {
    return Boolean(
      process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME
    );
  }

  async upload(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string
  ): Promise<StorageResult> {
    if (this.isR2Configured()) {
      try {
        const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
        const endpoint =
          process.env.R2_ENDPOINT ||
          `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const s3 = new S3Client({
          region: "auto",
          endpoint,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          },
        });

        const extMatch = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";
        const storageKey = `resumes/${crypto.randomUUID()}${ext}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: storageKey,
            Body: fileBuffer,
            ContentType: mimeType,
          })
        );

        return {
          storageKey,
          fileUrl: storageKey,
        };
      } catch (r2Error) {
        console.warn("[StorageProvider] Cloudflare R2 upload failed, falling back to local/tmp storage:", r2Error);
      }
    }

    return this.localProvider.upload(fileBuffer, originalFilename, mimeType);
  }

  async delete(storageKey: string): Promise<void> {
    if (this.isR2Configured() && storageKey.startsWith("resumes/")) {
      try {
        const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const endpoint =
          process.env.R2_ENDPOINT ||
          `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const s3 = new S3Client({
          region: "auto",
          endpoint,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          },
        });

        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: storageKey,
          })
        );
        return;
      } catch (e) {
        console.warn("[StorageProvider] Failed to delete from R2:", e);
      }
    }

    return this.localProvider.delete(storageKey);
  }
}

// Export singleton instance of hybrid storage provider
export const storageProvider: StorageProvider = new HybridStorageProvider();
