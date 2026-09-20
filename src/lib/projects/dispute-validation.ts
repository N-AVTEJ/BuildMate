import { ProjectStatus } from "@/lib/project-status";

// -----------------------------------------------------------------------------
// Dispute Reasons & Role-Specific Enums
// -----------------------------------------------------------------------------

export const CLIENT_DISPUTE_REASONS = [
  "MISSING_FEATURE",
  "DOESNT_MATCH_REQUIREMENTS",
  "INCORRECT_PROJECT",
  "TECHNICAL_ISSUE",
  "PAYMENT_ISSUE",
  "OTHER",
] as const;

export type ClientDisputeReason = (typeof CLIENT_DISPUTE_REASONS)[number];

export const BUILDER_DISPUTE_REASONS = [
  "CLIENT_NOT_RESPONDING",
  "REQUIREMENT_CHANGED",
  "PAYMENT_ISSUE",
  "OTHER",
] as const;

export type BuilderDisputeReason = (typeof BUILDER_DISPUTE_REASONS)[number];

export type DisputeReason = ClientDisputeReason | BuilderDisputeReason;

// -----------------------------------------------------------------------------
// Dispute Creation Status Allowlists
// -----------------------------------------------------------------------------

export const CLIENT_DISPUTE_STATUS_ALLOWLIST: readonly ProjectStatus[] = [
  "IN_PROGRESS",
  "OVERDUE",
  "SUBMITTED_FOR_DELIVERY",
  "FINAL_PAYMENT_PENDING",
  "FINAL_PAYMENT_PROOF_SUBMITTED",
  "FINAL_PAYMENT_VERIFICATION",
  "DELIVERY_UNLOCKED",
  "COMPLETED",
];

export const BUILDER_DISPUTE_STATUS_ALLOWLIST: readonly ProjectStatus[] = [
  "IN_PROGRESS",
  "OVERDUE",
  "SUBMITTED_FOR_DELIVERY",
  "FINAL_PAYMENT_PENDING",
  "FINAL_PAYMENT_PROOF_SUBMITTED",
  "FINAL_PAYMENT_VERIFICATION",
];

// Terminal statuses that can NEVER enter dispute
export const FORBIDDEN_DISPUTE_STATUSES: readonly ProjectStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "AVAILABLE",
  "ACCEPTED_PENDING_QUOTE",
  "QUOTATION_SENT",
  "AWAITING_ADVANCE",
  "REJECTED",
  "EXPIRED_NO_BUILDER",
  "ADVANCE_PAYMENT_EXPIRED",
  "CANCELLED_BEFORE_DEV",
  "CANCELLED",
  "DISPUTE_OPEN",
];

// -----------------------------------------------------------------------------
// Admin Resolution Actions (Allowlisted)
// -----------------------------------------------------------------------------

export const ADMIN_RESOLUTION_ACTIONS = [
  "RETURN_TO_DEVELOPMENT",
  "RETURN_TO_DELIVERY",
  "CANCEL_PROJECT",
] as const;

export type AdminResolutionAction = (typeof ADMIN_RESOLUTION_ACTIONS)[number];

export interface AdminResolutionMapping {
  targetStatus: ProjectStatus;
  label: string;
}

export const ADMIN_RESOLUTION_MAP: Record<AdminResolutionAction, AdminResolutionMapping> = {
  RETURN_TO_DEVELOPMENT: {
    targetStatus: "IN_PROGRESS",
    label: "Return to Development (In Progress)",
  },
  RETURN_TO_DELIVERY: {
    targetStatus: "DELIVERY_UNLOCKED",
    label: "Return to Delivery Review (Delivery Unlocked)",
  },
  CANCEL_PROJECT: {
    targetStatus: "CANCELLED",
    label: "Cancel Project (Terminated by Dispute)",
  },
};

// -----------------------------------------------------------------------------
// Message Sanitization
// -----------------------------------------------------------------------------

/**
 * Strips HTML tags and normalizes message body.
 * Guaranteed plain-text only, maximum 2000 characters.
 */
export function sanitizeMessageBody(rawBody: unknown): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  if (typeof rawBody !== "string") {
    return { valid: false, error: "Message body must be a string." };
  }

  // Strip all HTML tags
  const stripped = rawBody.replace(/<[^>]*>/g, "");
  const trimmed = stripped.trim();

  if (!trimmed) {
    return { valid: false, error: "Message body cannot be empty." };
  }

  if (trimmed.length > 2000) {
    return {
      valid: false,
      error: `Message body exceeds maximum length of 2000 characters (got ${trimmed.length}).`,
    };
  }

  return { valid: true, sanitized: trimmed };
}

// -----------------------------------------------------------------------------
// Dispute Submission Validation
// -----------------------------------------------------------------------------

export function validateDisputeSubmission(
  body: unknown,
  role: "CLIENT" | "BUILDER",
  projectStatus: ProjectStatus
): {
  valid: boolean;
  error?: string;
  data?: {
    reason: DisputeReason;
    description: string;
  };
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  // 1. Status allowlist validation
  const allowlist =
    role === "CLIENT"
      ? CLIENT_DISPUTE_STATUS_ALLOWLIST
      : BUILDER_DISPUTE_STATUS_ALLOWLIST;

  if (!allowlist.includes(projectStatus)) {
    return {
      valid: false,
      error: `Cannot open a dispute for a project in ${projectStatus} status. Active development or delivery state required.`,
    };
  }

  const b = body as Record<string, unknown>;

  // 2. Reason validation
  if (typeof b.reason !== "string" || !b.reason.trim()) {
    return { valid: false, error: "Dispute reason is required." };
  }

  const reason = b.reason.trim();

  if (role === "CLIENT") {
    if (!CLIENT_DISPUTE_REASONS.includes(reason as ClientDisputeReason)) {
      return {
        valid: false,
        error: `Invalid dispute reason for client. Allowed reasons: ${CLIENT_DISPUTE_REASONS.join(", ")}.`,
      };
    }
  } else {
    if (!BUILDER_DISPUTE_REASONS.includes(reason as BuilderDisputeReason)) {
      return {
        valid: false,
        error: `Invalid dispute reason for builder. Allowed reasons: ${BUILDER_DISPUTE_REASONS.join(", ")}.`,
      };
    }
  }

  // 3. Description validation
  if (typeof b.description !== "string") {
    return { valid: false, error: "Dispute description is required." };
  }

  const description = b.description.trim();

  if (description.length < 10) {
    return {
      valid: false,
      error: "Dispute description must be at least 10 characters.",
    };
  }

  if (description.length > 3000) {
    return {
      valid: false,
      error: "Dispute description cannot exceed 3000 characters.",
    };
  }

  return {
    valid: true,
    data: {
      reason: reason as DisputeReason,
      description,
    },
  };
}

// -----------------------------------------------------------------------------
// Admin Resolution Validation (Invariants 5 & 8)
// -----------------------------------------------------------------------------

export function validateAdminResolution(body: unknown): {
  valid: boolean;
  error?: string;
  data?: {
    action: AdminResolutionAction;
    targetStatus: ProjectStatus;
    resolutionNote: string;
  };
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const b = body as Record<string, unknown>;

  // Invariant 8: Explicitly reject COMPLETED
  if (
    b.action === "COMPLETED" ||
    b.action === "MARK_COMPLETED" ||
    b.targetStatus === "COMPLETED"
  ) {
    return {
      valid: false,
      error:
        "Forbidden: Admin resolution cannot directly mark a project COMPLETED. Marking complete requires client delivery review.",
    };
  }

  // Invariant 5: Allowlisted actions only
  if (
    typeof b.action !== "string" ||
    !ADMIN_RESOLUTION_ACTIONS.includes(b.action as AdminResolutionAction)
  ) {
    return {
      valid: false,
      error: `Invalid resolution action. Allowed actions: ${ADMIN_RESOLUTION_ACTIONS.join(", ")}.`,
    };
  }

  const action = b.action as AdminResolutionAction;
  const targetStatus = ADMIN_RESOLUTION_MAP[action].targetStatus;

  // Resolution note validation
  if (typeof b.resolutionNote !== "string" || !b.resolutionNote.trim()) {
    return { valid: false, error: "Resolution note is required." };
  }

  const resolutionNote = b.resolutionNote.trim();

  if (resolutionNote.length < 10) {
    return {
      valid: false,
      error: "Resolution note must be at least 10 characters explaining the administrative verdict.",
    };
  }

  if (resolutionNote.length > 3000) {
    return {
      valid: false,
      error: "Resolution note cannot exceed 3000 characters.",
    };
  }

  return {
    valid: true,
    data: {
      action,
      targetStatus,
      resolutionNote,
    },
  };
}
