import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Re-export storageProvider for existing routes (e.g. project requirements upload)
export {
  storageProvider,
  LocalStorageProvider,
  type StorageProvider,
  type StorageResult,
} from "./storage/index";

export const ALLOWED_PROOF_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;
export type AllowedProofExtension = (typeof ALLOWED_PROOF_EXTENSIONS)[number];

export const ALLOWED_PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedProofMimeType = (typeof ALLOWED_PROOF_MIME_TYPES)[number];

export const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface StorageConfig {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  endpoint?: string;
}

function getR2Config(): StorageConfig {
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    endpoint:
      process.env.R2_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined),
  };
}

export class StorageConfigurationError extends Error {
  status: number;
  constructor(
    message = "Payment proof storage is currently unavailable. Cloudflare R2 storage is not configured in this environment.",
    status = 503
  ) {
    super(message);
    this.name = "StorageConfigurationError";
    this.status = status;
  }
}

export function isR2Configured(config: StorageConfig = getR2Config()): boolean {
  return !!(
    config.accountId &&
    config.accessKeyId &&
    config.secretAccessKey &&
    config.bucketName
  );
}

// Singleton S3 client instance for Cloudflare R2
let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3ClientInstance) return s3ClientInstance;

  const config = getR2Config();
  const isProduction = process.env.NODE_ENV === "production";

  if (!isR2Configured(config)) {
    if (isProduction) {
      throw new StorageConfigurationError(
        "Payment proof storage is currently unavailable. Cloudflare R2 storage is not configured in production environment.",
        503
      );
    }
  }

  s3ClientInstance = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId || "mock-access-key",
      secretAccessKey: config.secretAccessKey || "mock-secret-key",
    },
  });

  return s3ClientInstance;
}

// In-memory mock storage registry for offline testing and dev without R2 credentials
const localMockStorage = new Map<string, { buffer?: Buffer; size: number; contentType: string }>();

export function registerMockFile(key: string, size = 1024, contentType = "image/png"): void {
  localMockStorage.set(key, { size, contentType });
}

export function clearMockStorage(): void {
  localMockStorage.clear();
}

/**
 * Validates whether a file extension is permitted for payment proofs.
 */
export function isValidProofExtension(ext: string): ext is AllowedProofExtension {
  const normalized = ext.toLowerCase().startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return ALLOWED_PROOF_EXTENSIONS.includes(normalized as AllowedProofExtension);
}

/**
 * Validates whether a MIME type is permitted for payment proofs.
 */
export function isValidProofMimeType(mime: string): mime is AllowedProofMimeType {
  return ALLOWED_PROOF_MIME_TYPES.includes(mime.toLowerCase() as AllowedProofMimeType);
}

/**
 * Inspects buffer magic bytes to ensure file content matches declared image format.
 */
export function validateProofBuffer(buffer: Buffer): {
  valid: boolean;
  detectedType?: string;
  error?: string;
} {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: "File buffer is too small to determine format." };
  }

  if (buffer.length > MAX_PROOF_SIZE_BYTES) {
    return { valid: false, error: `File exceeds maximum permitted size of 5 MB.` };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedType: "image/png" };
  }

  // WEBP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedType: "image/webp" };
  }

  return { valid: false, error: "File content magic bytes do not match an allowed image type." };
}

/**
 * Generates a strictly server-controlled, unpredictable key scoped to project and payment type.
 */
export function generatePaymentProofKey(
  projectId: string,
  paymentType: string,
  extension: string
): string {
  const cleanExt = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  const randomUuid = crypto.randomUUID();
  return `proofs/${projectId}/${paymentType.toLowerCase()}/${randomUuid}${cleanExt}`;
}

/**
 * Validates that an object key belongs to the expected project and payment type prefix.
 */
export function isKeyInProjectScope(
  key: string,
  projectId: string,
  paymentType: string
): boolean {
  if (!key || typeof key !== "string") return false;
  // Disallow path traversal
  if (key.includes("..") || key.includes("//")) return false;

  const expectedPrefix = `proofs/${projectId}/${paymentType.toLowerCase()}/`;
  if (!key.startsWith(expectedPrefix)) return false;

  const fileName = key.slice(expectedPrefix.length);
  // Must have an allowed extension
  const ext = path.extname(fileName).toLowerCase();
  return isValidProofExtension(ext);
}

/**
 * Generates a presigned PUT URL for uploading a payment proof directly to Cloudflare R2.
 * TTL: short ~5 minutes (300 seconds).
 */
export async function getUploadUrl(
  key: string,
  contentType = "image/png",
  expiresInSeconds = 300
): Promise<string> {
  const config = getR2Config();

  if (!isR2Configured(config)) {
    if (process.env.NODE_ENV === "production") {
      throw new StorageConfigurationError(
        "Payment proof storage is currently unavailable. Cloudflare R2 storage is not configured in production environment.",
        503
      );
    }
    // Local dev/test fallback: HMAC signed local upload URL
    const hmac = crypto
      .createHmac("sha256", process.env.SESSION_SECRET || "dev-storage-secret")
      .update(`${key}:${contentType}:${Date.now() + expiresInSeconds * 1000}`)
      .digest("hex");
    registerMockFile(key, 0, contentType);
    return `/api/files/upload?key=${encodeURIComponent(key)}&sig=${hmac}&expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  const s3 = getS3Client();
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Generates a presigned GET URL for viewing a payment proof from Cloudflare R2.
 * TTL: short ~60 seconds. Never returns permanent public URLs.
 */
export async function getDownloadUrl(
  key: string,
  expiresInSeconds = 60
): Promise<string> {
  const config = getR2Config();

  if (!isR2Configured(config)) {
    if (process.env.NODE_ENV === "production") {
      throw new StorageConfigurationError(
        "Payment proof download is currently unavailable. Cloudflare R2 storage is not configured in production environment.",
        503
      );
    }
    // Local dev/test fallback
    const hmac = crypto
      .createHmac("sha256", process.env.SESSION_SECRET || "dev-storage-secret")
      .update(`${key}:${Date.now() + expiresInSeconds * 1000}`)
      .digest("hex");
    return `/api/files/download?key=${encodeURIComponent(key)}&sig=${hmac}&expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  const s3 = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Verifies that the given storage key exists in Cloudflare R2 (or local test registry)
 * before inserting payment proof records into the database.
 */
export async function verifyStorageObjectExists(
  key: string
): Promise<{ exists: boolean; size?: number; contentType?: string }> {
  const config = getR2Config();

  if (!isR2Configured(config)) {
    if (process.env.NODE_ENV === "production") {
      throw new StorageConfigurationError(
        "Storage object verification is currently unavailable. Cloudflare R2 storage is not configured in production environment.",
        503
      );
    }
    // Check local mock registry or disk
    if (localMockStorage.has(key)) {
      const item = localMockStorage.get(key)!;
      return { exists: true, size: item.size, contentType: item.contentType };
    }
    // Also check local uploads dir if present
    const localPath = path.join(process.cwd(), "storage", "uploads", path.basename(key));
    try {
      const stat = await fs.stat(localPath);
      return { exists: true, size: stat.size };
    } catch {
      return { exists: false };
    }
  }

  const s3 = getS3Client();
  try {
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );
    return {
      exists: true,
      size: head.ContentLength,
      contentType: head.ContentType,
    };
  } catch (error: any) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    throw error;
  }
}
