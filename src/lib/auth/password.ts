import argon2 from "argon2";

// Static dummy Argon2id hash used to equalize response timing when a user does not exist
// This prevents timing-based user enumeration attacks.
const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$9v8q81VqTfW1F3c5tF5v+X+zF9r3tF5v+X+zF9r3tF4";

/**
 * Validates password requirement:
 * - Non-empty and minimum 8 characters
 * OR
 * - Passphrase with at least 4 whitespace-separated words
 */
export function validatePasswordComplexity(password: string): {
  valid: boolean;
  message?: string;
} {
  if (!password || typeof password !== "string") {
    return {
      valid: false,
      message: "Password is required.",
    };
  }

  const trimmed = password.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  // Check if it satisfies the 4-word passphrase requirement
  if (words.length >= 4) {
    return { valid: true };
  }

  // Otherwise enforce minimum 8 characters
  if (trimmed.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long (or a 4-word passphrase).",
    };
  }

  return { valid: true };
}

/**
 * Hashes a plaintext password using Argon2id.
 * Passwords must never be logged or returned.
 */
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(
  hash: string,
  plainText: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    return false;
  }
}

/**
 * Executes a dummy Argon2id verification for nonexistent users
 * to match real verification execution time and thwart timing analysis.
 */
export async function dummyVerifyPassword(plainText: string): Promise<boolean> {
  try {
    await argon2.verify(DUMMY_ARGON2_HASH, plainText);
  } catch {
    // Ignore dummy verification errors
  }
  return false;
}

/**
 * Executes a dummy Argon2id hash for timing equalization on duplicate registrations.
 */
export async function dummyHashPassword(plainText: string): Promise<void> {
  try {
    await argon2.hash(plainText, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  } catch {
    // Ignore dummy hash errors
  }
}
