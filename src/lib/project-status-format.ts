/**
 * Utility to format internal database status enums into compliant, user-facing copy.
 * 
 * Invariant: Never alters backend database enums or status transitions.
 * Ensures user interface strictly adheres to Razorpay and RBI Payment Aggregator
 * compliance policies (displaying compliant milestone-based terminology).
 */
export function formatProjectStatus(status: string | null | undefined): string {
  if (!status) return "—";

  switch (status) {
    case "AWAITING_ADVANCE":
      return "AWAITING INITIAL MILESTONE";
    case "ADVANCE_PROOF_SUBMITTED":
      return "INITIAL PAYMENT SUBMITTED";
    case "ADVANCE_VERIFICATION":
      return "VERIFYING INITIAL MILESTONE";
    case "ADVANCE_VERIFIED":
      return "INITIAL MILESTONE VERIFIED";
    case "ACCEPTED_PENDING_QUOTE":
      return "AWAITING QUOTATION";
    case "QUOTATION_SENT":
      return "QUOTATION SENT";
    case "IN_PROGRESS":
      return "IN PROGRESS";
    case "FINAL_PAYMENT_PENDING":
      return "FINAL MILESTONE PENDING";
    case "FINAL_PAYMENT_PROOF_SUBMITTED":
      return "FINAL PROOF SUBMITTED";
    case "SUBMITTED_FOR_DELIVERY":
      return "DELIVERY SUBMITTED";
    case "CLIENT_REVIEW":
      return "CLIENT REVIEW";
    case "DELIVERY_UNLOCKED":
      return "DELIVERY UNLOCKED";
    case "COMPLETED":
      return "COMPLETED";
    case "DISPUTE_OPEN":
      return "DISPUTE OPEN";
    case "EXPIRED_NO_BUILDER":
      return "EXPIRED (NO BUILDER)";
    case "AVAILABLE":
      return "AVAILABLE";
    case "OVERDUE":
      return "OVERDUE";
    default:
      return status.replace(/_/g, " ");
  }
}

/**
 * Client-facing plain-language formatter.
 * Converts raw database enums into calm, non-technical human sentences.
 */
export function formatClientProjectStatus(status: string | null | undefined): string {
  if (!status) return "—";

  switch (status) {
    case "AVAILABLE":
      return "Finding verified builders";
    case "ACCEPTED_PENDING_QUOTE":
      return "Waiting for price quote";
    case "QUOTATION_SENT":
      return "Price quote received";
    case "AWAITING_ADVANCE":
      return "Waiting for advance payment";
    case "ADVANCE_PROOF_SUBMITTED":
      return "Advance payment submitted";
    case "ADVANCE_VERIFICATION":
      return "Verifying advance payment";
    case "ADVANCE_VERIFIED":
      return "Advance payment verified";
    case "IN_PROGRESS":
      return "Development in progress";
    case "OVERDUE":
      return "Project overdue";
    case "FINAL_PAYMENT_PENDING":
      return "Waiting for final payment";
    case "FINAL_PAYMENT_PROOF_SUBMITTED":
      return "Final payment submitted";
    case "SUBMITTED_FOR_DELIVERY":
      return "Final files submitted";
    case "CLIENT_REVIEW":
      return "Review final files";
    case "DELIVERY_UNLOCKED":
      return "Final files ready";
    case "COMPLETED":
      return "Completed";
    case "DISPUTE_OPEN":
      return "Problem under review";
    case "EXPIRED_NO_BUILDER":
      return "Expired (No builder assigned)";
    default:
      return status.replace(/_/g, " ").toLowerCase();
  }
}
