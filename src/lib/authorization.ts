import { SessionValidationResult } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/guards";

export type AuthAction =
  // Auth actions (Phase 2)
  | "AUTH_REGISTER"
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "AUTH_VERIFY_EMAIL"
  | "AUTH_RESEND_VERIFICATION"
  | "AUTH_VIEW_PROFILE"
  // Client project actions (Phase 3)
  | "PROJECT_CREATE"
  | "PROJECT_LIST_OWN"
  | "PROJECT_VIEW_OWN"
  | "PROJECT_UPLOAD_REQUIREMENT"
  // Builder discovery & acceptance actions (Phase 4)
  | "PROJECT_LIST_AVAILABLE"
  | "PROJECT_VIEW_AVAILABLE"
  | "PROJECT_ACCEPT"
  | "PROJECT_REJECT"
  // Admin actions (Phase 4)
  | "ADMIN_VIEW_DASHBOARD"
  | "ADMIN_VIEW_ALL_PROJECTS"
  // Quotation & Scope Lock actions (Phase 5)
  | "QUOTATION_SUBMIT"
  | "QUOTATION_VIEW"
  | "QUOTATION_ACCEPT"
  | "QUOTATION_REJECT"
  | "CHANGE_REQUEST_SUBMIT"
  | "CHANGE_REQUEST_RESPOND"
  // Payment Proof & Verification actions (Phase 6)
  | "PAYMENT_VIEW_INFO"
  | "PAYMENT_SUBMIT_PROOF"
  | "PAYMENT_VIEW"
  | "ADMIN_PAYMENT_LIST"
  | "ADMIN_PAYMENT_VERIFY"
  | "ADMIN_PAYMENT_REJECT"
  // Deadline Engine & Progress actions (Phase 7)
  | "PROJECT_UPDATE_PROGRESS"
  | "ADMIN_RESOLVE_OVERDUE";

export interface ProjectResourceContext {
  clientId?: string;
  builderId?: string | null;
  status?: string;
}

/**
 * Pure evaluation of whether the given authenticated user/session is authorized
 * to attempt the requested action against an optional resource.
 *
 * Centralized authorization rules:
 * - ADMIN: Explicitly bypassed for viewing all projects and dashboard.
 * - CLIENT: May create, list own, view own, and upload requirements to own projects (requires verified email where appropriate).
 * - BUILDER: May list available, view available, accept, and reject projects.
 */
export function can(
  auth: SessionValidationResult | null,
  action: AuthAction,
  resource?: ProjectResourceContext
): { allowed: boolean; reason?: string } {
  // Public unauthenticated actions
  if (
    action === "AUTH_REGISTER" ||
    action === "AUTH_LOGIN" ||
    action === "AUTH_VERIFY_EMAIL"
  ) {
    return { allowed: true };
  }

  // All other actions require an authenticated session
  if (!auth) {
    return { allowed: false, reason: "Authentication required." };
  }

  const userRoles = auth.roles;
  const isAdmin = userRoles.includes("ADMIN");
  const isClient = userRoles.includes("CLIENT");
  const isBuilder = userRoles.includes("BUILDER");

  switch (action) {
    case "AUTH_LOGOUT":
    case "AUTH_RESEND_VERIFICATION":
    case "AUTH_VIEW_PROFILE":
      return { allowed: true };

    case "PROJECT_CREATE":
      if (!isClient) {
        return { allowed: false, reason: "Client role required to create projects." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to submit projects." };
      }
      return { allowed: true };

    case "PROJECT_LIST_OWN":
      if (!isClient) {
        return { allowed: false, reason: "Client role required to view client project portal." };
      }
      return { allowed: true };

    case "PROJECT_VIEW_OWN":
      // Explicit central ADMIN bypass: Admins may view any project
      if (isAdmin) {
        return { allowed: true };
      }
      // Clients can only view their own projects
      if (isClient && resource && resource.clientId === auth.user.id) {
        return { allowed: true };
      }
      // Builders can view if assigned to the project or if project is AVAILABLE for discovery
      if (isBuilder && resource) {
        if (resource.builderId === auth.user.id) {
          return { allowed: true };
        }
        if (resource.status === "AVAILABLE") {
          return { allowed: true };
        }
      }
      return { allowed: false, reason: "Access denied. You do not have permission to view this project." };

    case "PROJECT_UPLOAD_REQUIREMENT":
      if (!isClient) {
        return { allowed: false, reason: "Client role required to upload requirements." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to upload requirements." };
      }
      if (resource && resource.clientId !== auth.user.id) {
        return { allowed: false, reason: "Cannot upload requirements to a project you do not own." };
      }
      return { allowed: true };

    case "PROJECT_LIST_AVAILABLE":
      if (isBuilder || isAdmin) {
        return { allowed: true };
      }
      return { allowed: false, reason: "Builder or Admin role required to discover available projects." };

    case "PROJECT_VIEW_AVAILABLE":
      if (isAdmin) {
        return { allowed: true };
      }
      if (isBuilder) {
        if (!resource || resource.status === "AVAILABLE" || resource.builderId === auth.user.id) {
          return { allowed: true };
        }
      }
      return { allowed: false, reason: "Builder role required to inspect available projects." };

    case "PROJECT_ACCEPT":
      if (!isBuilder) {
        return { allowed: false, reason: "Builder role required to accept projects." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to accept projects." };
      }
      return { allowed: true };

    case "PROJECT_REJECT":
      if (!isBuilder) {
        return { allowed: false, reason: "Builder role required to reject projects." };
      }
      return { allowed: true };

    case "ADMIN_VIEW_DASHBOARD":
    case "ADMIN_VIEW_ALL_PROJECTS":
      if (!isAdmin) {
        return { allowed: false, reason: "Administrator role required." };
      }
      return { allowed: true };

    case "QUOTATION_SUBMIT":
      if (!isBuilder) {
        return { allowed: false, reason: "Builder role required to submit quotations." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to submit quotations." };
      }
      if (resource && resource.builderId && resource.builderId !== auth.user.id) {
        return { allowed: false, reason: "Cannot submit quotation for a project assigned to another builder." };
      }
      return { allowed: true };

    case "QUOTATION_VIEW":
      if (isAdmin) {
        return { allowed: true };
      }
      if (isClient && resource && resource.clientId === auth.user.id) {
        return { allowed: true };
      }
      if (isBuilder && resource && resource.builderId === auth.user.id) {
        return { allowed: true };
      }
      return { allowed: false, reason: "Access denied to project quotation." };

    case "QUOTATION_ACCEPT":
      if (!isClient) {
        return { allowed: false, reason: "Client role required to accept quotations." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to accept quotations." };
      }
      if (resource && resource.clientId && resource.clientId !== auth.user.id) {
        return { allowed: false, reason: "Cannot accept quotation for a project you do not own." };
      }
      return { allowed: true };

    case "QUOTATION_REJECT":
      if (!isClient) {
        return { allowed: false, reason: "Client role required to reject quotations." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to reject quotations." };
      }
      if (resource && resource.clientId && resource.clientId !== auth.user.id) {
        return { allowed: false, reason: "Cannot reject quotation for a project you do not own." };
      }
      return { allowed: true };

    case "CHANGE_REQUEST_SUBMIT":
      if (!isBuilder) {
        return { allowed: false, reason: "Builder role required to submit change requests." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to submit change requests." };
      }
      if (resource && resource.builderId && resource.builderId !== auth.user.id) {
        return { allowed: false, reason: "Cannot submit change request for a project assigned to another builder." };
      }
      return { allowed: true };

    case "CHANGE_REQUEST_RESPOND":
      if (!isClient) {
        return { allowed: false, reason: "Client role required to respond to change requests." };
      }
      if (resource && resource.clientId && resource.clientId !== auth.user.id) {
        return { allowed: false, reason: "Cannot respond to change request for a project you do not own." };
      }
      return { allowed: true };

    // Phase 6: Payment Actions
    case "PAYMENT_VIEW_INFO":
    case "PAYMENT_VIEW":
      if (isAdmin) {
        return { allowed: true };
      }
      if (isClient && resource && resource.clientId === auth.user.id) {
        return { allowed: true };
      }
      return { allowed: false, reason: "Access denied. You do not have permission to view this payment." };

    case "PAYMENT_SUBMIT_PROOF":
      if (!isClient) {
        return { allowed: false, reason: "Client role required to submit payment proofs." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to submit payment proofs." };
      }
      if (resource && resource.clientId && resource.clientId !== auth.user.id) {
        return { allowed: false, reason: "Cannot submit payment proof for a project you do not own." };
      }
      return { allowed: true };

    case "ADMIN_PAYMENT_LIST":
    case "ADMIN_PAYMENT_VERIFY":
    case "ADMIN_PAYMENT_REJECT":
    case "ADMIN_RESOLVE_OVERDUE":
      if (!isAdmin) {
        return { allowed: false, reason: "Administrator role required." };
      }
      return { allowed: true };

    case "PROJECT_UPDATE_PROGRESS":
      if (!isBuilder) {
        return { allowed: false, reason: "Builder role required to post progress updates." };
      }
      if (!auth.user.emailVerified) {
        return { allowed: false, reason: "Email verification required to post progress updates." };
      }
      if (resource && resource.builderId && resource.builderId !== auth.user.id) {
        return { allowed: false, reason: "Cannot post progress updates for a project you are not assigned to." };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: "Unrecognized authorization action." };
  }
}

/**
 * Asserts that the authenticated actor is authorized for the given action.
 * Throws AuthError(401) if unauthenticated.
 * Throws AuthError(403) if unauthorized.
 */
export function authorize(
  auth: SessionValidationResult | null,
  action: AuthAction,
  resource?: ProjectResourceContext
): asserts auth is SessionValidationResult {
  if (!auth) {
    throw new AuthError("Unauthorized. Please log in.", 401);
  }

  const decision = can(auth, action, resource);
  if (!decision.allowed) {
    throw new AuthError(
      decision.reason || "Forbidden. You do not have permission to perform this action.",
      403
    );
  }
}
