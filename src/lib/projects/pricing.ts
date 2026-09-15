/**
 * Phase 5 Canonical Pricing & Advance Calculation
 *
 * Rule:
 * advanceAmount = min(totalPrice, max(300, floor(totalPrice * 0.30)))
 * remainingAmount = totalPrice - advanceAmount
 *
 * This function is the single source of truth for advance calculation across:
 * - Quotation submission (POST /api/projects/[id]/quotation)
 * - Change-request acceptance (POST /api/projects/[id]/change-requests/[crId]/accept)
 */
export function computeAdvanceBreakdown(totalPrice: number): {
  advanceAmount: number;
  remainingAmount: number;
} {
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    throw new Error("totalPrice must be a positive number");
  }

  const roundedTotal = Math.floor(totalPrice);
  const thirtyPercent = Math.floor(roundedTotal * 0.3);
  const advanceAmount = Math.min(roundedTotal, Math.max(300, thirtyPercent));
  const remainingAmount = roundedTotal - advanceAmount;

  return {
    advanceAmount,
    remainingAmount,
  };
}
