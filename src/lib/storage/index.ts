import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

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
 * Local Storage Provider (DEVELOPMENT-ONLY STUB).
 *
 * Security Guarantees:
 * 1. Generates an unpredictable UUID storage key. The user's original filename
 *    is never used as the physical file path (eliminating path traversal).
 * 2. Files are stored in a dedicated local directory (`storage/uploads`) that is NOT
 *    configured as an executable or publicly browsable static asset directory.
 * 3. Provides clean file deletion to support transactional cleanup on database failure.
 *
 * In production environments, this stub should be swapped for an S3/Cloudflare R2 implementation.
 */
export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private fallbackDir: string;

  constructor(customUploadDir?: string) {
    this.uploadDir = customUploadDir || path.join(process.cwd(), "storage", "uploads");
    this.fallbackDir = path.join(require("os").tmpdir(), "buildmate-uploads");
  }

  private async ensureDir(): Promise<string> {
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
    const targetFilePath = path.join(activeDir, storageKey);

    // Write file to disk (try activeDir, fallback to fallbackDir if write fails)
    try {
      await fs.writeFile(targetFilePath, fileBuffer);
    } catch {
      await fs.mkdir(this.fallbackDir, { recursive: true });
      await fs.writeFile(path.join(this.fallbackDir, storageKey), fileBuffer);
    }

    // In local development, return reference URL
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

// Export singleton instance of storage provider
export const storageProvider: StorageProvider = new LocalStorageProvider();
