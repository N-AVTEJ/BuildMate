import path from "path";
import { sanitizeFilename } from "./validation";

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_RESUME_EXTENSIONS = ["pdf", "docx"] as const;
export type AllowedResumeExtension = (typeof ALLOWED_RESUME_EXTENSIONS)[number];

export interface ResumeValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
  detectedMime?: string;
  extension?: AllowedResumeExtension;
}

/**
 * Validates a resume buffer against strict size, extension allowlist (.pdf, .docx only),
 * and binary magic bytes inspection.
 * Reuses the Phase 3 security allowlist pattern.
 */
export function validateResumeFile(
  buffer: Buffer,
  originalFilename: string
): ResumeValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Resume file cannot be empty." };
  }

  if (buffer.length > MAX_RESUME_SIZE_BYTES) {
    return { valid: false, error: "Resume file size exceeds the 5 MB maximum limit." };
  }

  const sanitized = sanitizeFilename(originalFilename);
  const extMatch = sanitized.match(/\.([a-zA-Z0-9]+)$/);
  if (!extMatch) {
    return {
      valid: false,
      error: "Resume must have a valid extension (.pdf or .docx).",
    };
  }

  const ext = extMatch[1].toLowerCase();
  if (ext !== "pdf" && ext !== "docx") {
    return {
      valid: false,
      error: `Invalid file format .${ext}. Only PDF (.pdf) and Word documents (.docx) are permitted for resumes.`,
    };
  }

  // 1. PDF Magic Bytes: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (ext === "pdf") {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x25 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x44 ||
      buffer[3] !== 0x46
    ) {
      return { valid: false, error: "File content does not match a valid PDF document signature." };
    }
    return {
      valid: true,
      sanitizedFilename: sanitized,
      detectedMime: "application/pdf",
      extension: "pdf",
    };
  }

  // 2. DOCX Magic Bytes: PK zip archive containing [Content_Types].xml and word/
  if (ext === "docx") {
    const isZipContainer =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);

    if (!isZipContainer) {
      return { valid: false, error: "File content does not match a valid DOCX archive signature." };
    }

    const hasContentTypes = buffer.includes(Buffer.from("[Content_Types].xml"));
    const hasWord = buffer.includes(Buffer.from("word/"));
    if (!hasContentTypes || !hasWord) {
      return { valid: false, error: "File is not a valid DOCX WordprocessingML package." };
    }

    return {
      valid: true,
      sanitizedFilename: sanitized,
      detectedMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    };
  }

  return { valid: false, error: "Unsupported resume file format." };
}
