import path from "path";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type AllowedExtension = "png" | "jpg" | "jpeg" | "pdf" | "zip" | "docx" | "pptx";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
  detectedMime?: string;
}

const ALLOWED_EXTENSIONS: Record<string, { mime: string[]; category: string }> = {
  png: { mime: ["image/png"], category: "PNG" },
  jpg: { mime: ["image/jpeg"], category: "JPEG" },
  jpeg: { mime: ["image/jpeg"], category: "JPEG" },
  pdf: { mime: ["application/pdf"], category: "PDF" },
  zip: { mime: ["application/zip", "application/x-zip-compressed", "multipart/x-zip"], category: "ZIP" },
  docx: {
    mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    category: "DOCX",
  },
  pptx: {
    mime: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    category: "PPTX",
  },
};

/**
 * Sanitizes a filename to prevent path traversal and shell injection.
 * Strips directories, removes non-alphanumeric characters (except dots, underscores, dashes).
 */
export function sanitizeFilename(originalName: string): string {
  // Strip path traversal attempts
  const baseName = path.basename(originalName).replace(/\0/g, "");
  // Remove dangerous special characters, retain only safe ASCII alphanumeric, dot, underscore, dash
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized || "attachment";
}

/**
 * Validates a file buffer against size, filename allowlist, and binary magic bytes.
 * Never trusts client-reported MIME type or extension alone.
 */
export function validateUploadFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType: string
): FileValidationResult {
  // 1. File Size Check (<= 5 MB)
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "File cannot be empty." };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "File size exceeds 5 MB maximum limit." };
  }

  // 2. Filename and Extension Allowlist
  const sanitized = sanitizeFilename(originalFilename);
  const extMatch = sanitized.match(/\.([a-zA-Z0-9]+)$/);
  if (!extMatch) {
    return {
      valid: false,
      error: "File must have a valid extension (.png, .jpg, .jpeg, .pdf, .zip, .docx, .pptx).",
    };
  }

  const ext = extMatch[1].toLowerCase();

  // TXT is explicitly rejected
  if (ext === "txt") {
    return { valid: false, error: "TXT files are not allowed. Allowed types: PNG, JPEG, PDF, ZIP, DOCX, PPTX." };
  }

  if (!ALLOWED_EXTENSIONS[ext]) {
    return {
      valid: false,
      error: `File extension .${ext} is not allowed. Allowed types: PNG, JPEG, PDF, ZIP, DOCX, PPTX.`,
    };
  }

  // 3. Binary Magic Bytes / Signature Verification
  if (ext === "pdf") {
    // PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46)
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x25 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x44 ||
      buffer[3] !== 0x46
    ) {
      return { valid: false, error: "File content does not match valid PDF signature." };
    }
    return { valid: true, sanitizedFilename: sanitized, detectedMime: "application/pdf" };
  }

  if (ext === "png") {
    // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47 ||
      buffer[4] !== 0x0d ||
      buffer[5] !== 0x0a ||
      buffer[6] !== 0x1a ||
      buffer[7] !== 0x0a
    ) {
      return { valid: false, error: "File content does not match valid PNG signature." };
    }
    return { valid: true, sanitizedFilename: sanitized, detectedMime: "image/png" };
  }

  if (ext === "jpg" || ext === "jpeg") {
    // JPEG magic bytes: 0xFF 0xD8 0xFF
    if (
      buffer.length < 3 ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8 ||
      buffer[2] !== 0xff
    ) {
      return { valid: false, error: "File content does not match valid JPEG signature." };
    }
    return { valid: true, sanitizedFilename: sanitized, detectedMime: "image/jpeg" };
  }

  // ZIP, DOCX, PPTX share PK header: 0x50 0x4B 0x03 0x04 (or 0x50 0x4B 0x05 0x06 empty archive)
  const isZipContainer =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);

  if (!isZipContainer) {
    return { valid: false, error: `File content does not match valid ${ext.toUpperCase()} archive signature.` };
  }

  const rawString = buffer.subarray(0, Math.min(buffer.length, 16384)).toString("binary");

  if (ext === "docx") {
    // DOCX container validation: Must be a ZIP containing [Content_Types].xml and word/
    const hasContentTypes = rawString.includes("[Content_Types].xml");
    const hasWord = rawString.includes("word/");
    if (!hasContentTypes || !hasWord) {
      return { valid: false, error: "File is not a valid DOCX WordprocessingML package." };
    }
    return {
      valid: true,
      sanitizedFilename: sanitized,
      detectedMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  if (ext === "pptx") {
    // PPTX container validation: Must be a ZIP containing [Content_Types].xml and ppt/
    const hasContentTypes = rawString.includes("[Content_Types].xml");
    const hasPpt = rawString.includes("ppt/");
    if (!hasContentTypes || !hasPpt) {
      return { valid: false, error: "File is not a valid PPTX PresentationML package." };
    }
    return {
      valid: true,
      sanitizedFilename: sanitized,
      detectedMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
  }

  if (ext === "zip") {
    return { valid: true, sanitizedFilename: sanitized, detectedMime: "application/zip" };
  }

  return { valid: false, error: "Unsupported file type." };
}
