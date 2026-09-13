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

  constructor(customUploadDir?: string) {
    this.uploadDir = customUploadDir || path.join(process.cwd(), "storage", "uploads");
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  async upload(
    fileBuffer: Buffer,
    originalFilename: string,
    _mimeType: string
  ): Promise<StorageResult> {
    await this.ensureDir();

    // Extract safe extension
    const extMatch = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";

    // Generate random UUID key (unpredictable and path-traversal free)
    const storageKey = `${crypto.randomUUID()}${ext}`;
    const targetFilePath = path.join(this.uploadDir, storageKey);

    // Write file to disk
    await fs.writeFile(targetFilePath, fileBuffer);

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

    try {
      await fs.unlink(targetFilePath);
    } catch {
      // File may already be absent
    }
  }
}

// Export singleton instance of storage provider
export const storageProvider: StorageProvider = new LocalStorageProvider();
