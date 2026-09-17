/**
 * Deliverable input & GitHub URL validation.
 *
 * SECURITY INVARIANT (Spec Section 26):
 * - GitHub URLs must parse as well-formed URLs with strictly "https:" scheme.
 * - Allowed hosts are strictly limited to expected GitHub domains.
 * - Never execute, fetch, or render this URL server-side (preventing SSRF).
 * - All optional URLs must also enforce "https:" to prevent URI-based XSS (e.g. javascript:).
 */

export interface GitHubUrlValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

const ALLOWED_GITHUB_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "raw.githubusercontent.com",
]);

export function validateGitHubUrl(rawUrl: unknown): GitHubUrlValidationResult {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "GitHub repository URL is required." };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format for GitHub repository." };
  }

  // Scheme check: strictly https:
  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "GitHub URL must use the secure https:// protocol.",
    };
  }

  // Hostname check: strictly allowed GitHub hosts
  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_GITHUB_HOSTS.has(hostname)) {
    return {
      valid: false,
      error:
        "GitHub URL must point to github.com or raw.githubusercontent.com.",
    };
  }

  // Path check: must contain at least owner and repo (e.g. /owner/repo)
  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  if (pathSegments.length < 2) {
    return {
      valid: false,
      error:
        "GitHub URL must include both owner and repository name (e.g. https://github.com/owner/repo).",
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
  };
}

export function validateHttpsUrl(
  rawUrl: unknown,
  fieldName: string
): { valid: boolean; error?: string; normalizedUrl?: string } {
  if (rawUrl === null || rawUrl === undefined || rawUrl === "") {
    return { valid: true };
  }

  if (typeof rawUrl !== "string") {
    return { valid: false, error: `${fieldName} must be a string.` };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: `Invalid URL format for ${fieldName}.` };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `${fieldName} must use the secure https:// protocol.`,
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
  };
}

export interface DeliverableInputData {
  githubUrl: string;
  repoType: "public" | "private";
  branch: string;
  commitRef: string;
  description: string;
  implementedFeatures: string;
  documentationUrl?: string | null;
  pptUrl?: string | null;
  screenshots?: string[] | null;
  demoUrl?: string | null;
  deploymentUrl?: string | null;
}

export function validateDeliverableSubmission(
  body: unknown
): { valid: boolean; error?: string; data?: DeliverableInputData } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a valid JSON object." };
  }

  const b = body as Record<string, unknown>;

  // 1. Validate GitHub URL
  const ghResult = validateGitHubUrl(b.githubUrl);
  if (!ghResult.valid || !ghResult.normalizedUrl) {
    return { valid: false, error: ghResult.error };
  }

  // 2. Validate repoType
  if (
    typeof b.repoType !== "string" ||
    (b.repoType !== "public" && b.repoType !== "private")
  ) {
    return {
      valid: false,
      error: "repoType must be either 'public' or 'private'.",
    };
  }

  // 3. Validate branch
  if (
    typeof b.branch !== "string" ||
    !b.branch.trim() ||
    b.branch.trim().length > 100
  ) {
    return {
      valid: false,
      error: "branch is required and must be between 1 and 100 characters.",
    };
  }

  // 4. Validate commitRef
  if (
    typeof b.commitRef !== "string" ||
    !b.commitRef.trim() ||
    b.commitRef.trim().length > 100
  ) {
    return {
      valid: false,
      error:
        "commitRef is required and must be between 1 and 100 characters.",
    };
  }

  // 5. Validate description
  if (
    typeof b.description !== "string" ||
    b.description.trim().length < 10 ||
    b.description.trim().length > 5000
  ) {
    return {
      valid: false,
      error:
        "description is required and must be between 10 and 5000 characters.",
    };
  }

  // 6. Validate implementedFeatures
  if (
    typeof b.implementedFeatures !== "string" ||
    b.implementedFeatures.trim().length < 10 ||
    b.implementedFeatures.trim().length > 5000
  ) {
    return {
      valid: false,
      error:
        "implementedFeatures is required and must be between 10 and 5000 characters.",
    };
  }

  // 7. Validate optional URLs
  const docResult = validateHttpsUrl(b.documentationUrl, "documentationUrl");
  if (!docResult.valid) {
    return { valid: false, error: docResult.error };
  }

  const pptResult = validateHttpsUrl(b.pptUrl, "pptUrl");
  if (!pptResult.valid) {
    return { valid: false, error: pptResult.error };
  }

  const demoResult = validateHttpsUrl(b.demoUrl, "demoUrl");
  if (!demoResult.valid) {
    return { valid: false, error: demoResult.error };
  }

  const deployResult = validateHttpsUrl(b.deploymentUrl, "deploymentUrl");
  if (!deployResult.valid) {
    return { valid: false, error: deployResult.error };
  }

  // 8. Validate optional screenshots array
  let screenshots: string[] | null = null;
  if (b.screenshots !== undefined && b.screenshots !== null) {
    if (!Array.isArray(b.screenshots)) {
      return { valid: false, error: "screenshots must be an array of strings." };
    }
    if (b.screenshots.length > 10) {
      return {
        valid: false,
        error: "A maximum of 10 screenshot references is allowed.",
      };
    }
    for (const item of b.screenshots) {
      if (typeof item !== "string" || !item.trim()) {
        return {
          valid: false,
          error: "Each screenshot item must be a non-empty string.",
        };
      }
    }
    screenshots = b.screenshots.map((s) => s.trim());
  }

  return {
    valid: true,
    data: {
      githubUrl: ghResult.normalizedUrl,
      repoType: b.repoType as "public" | "private",
      branch: b.branch.trim(),
      commitRef: b.commitRef.trim(),
      description: b.description.trim(),
      implementedFeatures: b.implementedFeatures.trim(),
      documentationUrl: docResult.normalizedUrl || null,
      pptUrl: pptResult.normalizedUrl || null,
      demoUrl: demoResult.normalizedUrl || null,
      deploymentUrl: deployResult.normalizedUrl || null,
      screenshots,
    },
  };
}
