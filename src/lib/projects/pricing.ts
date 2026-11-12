/**
 * Canonical Pricing & Advance Calculation
 *
 * Rule:
 * advanceAmount = Math.floor(totalPrice * 0.50)
 * remainingAmount = totalPrice - advanceAmount
 *
 * This function is the single source of truth for advance calculation across:
 * - Quotation submission (POST /api/projects/[id]/quotation)
 * - Change-request acceptance (POST /api/projects/[id]/change-requests/[crId]/accept)
 */
export const MIN_QUOTATION_PRICE = 300;

export function computeAdvanceBreakdown(totalPrice: number): {
  advanceAmount: number;
  remainingAmount: number;
} {
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    throw new Error("totalPrice must be a positive number");
  }

  const roundedTotal = Math.floor(totalPrice);
  const advanceAmount = Math.floor(roundedTotal * 0.5);
  const remainingAmount = roundedTotal - advanceAmount;

  return {
    advanceAmount,
    remainingAmount,
  };
}
