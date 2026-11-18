export interface ProjectPaymentItem {
  id: string;
  type: "ADVANCE" | "FINAL";
  status: string;
  expectedAmount: number;
  submittedAmount?: number | null;
}

export interface PaymentSummaryProject {
  totalPrice: number | null;
  advanceAmount?: number | null;
  remainingAmount?: number | null;
}

export interface PaymentSummary {
  totalPrice: number | null;
  amountPaidSoFar: number;
  remainingBalance: number | null;
  advancePaid: boolean;
  finalPaid: boolean;
  displayText: string;
}

/**
 * Computes verified payment totals, remaining balance, and plain-language display text
 * for client project overview screens.
 */
export function computePaymentSummary(
  project: PaymentSummaryProject,
  projectPayments: ProjectPaymentItem[]
): PaymentSummary {
  const verifiedPayments = projectPayments.filter((p) => p.status === "VERIFIED");

  const amountPaidSoFar = verifiedPayments.reduce(
    (sum, p) => sum + (p.submittedAmount ?? p.expectedAmount ?? 0),
    0
  );

  const totalPrice =
    project.totalPrice ??
    (project.advanceAmount !== null &&
    project.remainingAmount !== null &&
    project.advanceAmount !== undefined &&
    project.remainingAmount !== undefined
      ? (project.advanceAmount || 0) + (project.remainingAmount || 0)
      : null);

  const remainingBalance =
    totalPrice !== null ? Math.max(0, totalPrice - amountPaidSoFar) : null;

  const advancePaid = verifiedPayments.some((p) => p.type === "ADVANCE");
  const finalPaid = verifiedPayments.some((p) => p.type === "FINAL");

  let displayText = "";
  if (totalPrice !== null && totalPrice > 0) {
    displayText = `Paid: ₹${amountPaidSoFar.toLocaleString("en-IN")} of ₹${totalPrice.toLocaleString("en-IN")} · Remaining: ₹${(remainingBalance ?? 0).toLocaleString("en-IN")}`;
  } else {
    displayText = `Paid: ₹${amountPaidSoFar.toLocaleString("en-IN")} · Price quote pending agreement`;
  }

  return {
    totalPrice,
    amountPaidSoFar,
    remainingBalance,
    advancePaid,
    finalPaid,
    displayText,
  };
}
