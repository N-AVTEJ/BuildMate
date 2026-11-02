/**
 * Utility to format internal database status enums into compliant, user-facing copy.
 * 
 * Invariant: Never alters backend database enums or status transitions.
 * Ensures user interface strictly adheres to Razorpay and RBI Payment Aggregator
 * compliance policies (no display of "ADVANCE", "ESCROW", etc.).
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
    default:
      return status.replace(/_/g, " ");
  }
}
