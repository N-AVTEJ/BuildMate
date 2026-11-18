import { describe, it, expect } from "vitest";
import { computePaymentSummary, ProjectPaymentItem } from "@/lib/projects/payment-summary";

describe("Phase 18 Fix 4 — computePaymentSummary", () => {
  it("calculates partial payment correctly: Paid: ₹150 of ₹900 · Remaining: ₹750", () => {
    const project = { totalPrice: 900, advanceAmount: 450, remainingAmount: 450 };
    const payments: ProjectPaymentItem[] = [
      {
        id: "pay-1",
        type: "ADVANCE",
        status: "VERIFIED",
        expectedAmount: 450,
        submittedAmount: 150,
      },
    ];

    const summary = computePaymentSummary(project, payments);
    expect(summary.totalPrice).toBe(900);
    expect(summary.amountPaidSoFar).toBe(150);
    expect(summary.remainingBalance).toBe(750);
    expect(summary.advancePaid).toBe(true);
    expect(summary.finalPaid).toBe(false);
    expect(summary.displayText).toBe("Paid: ₹150 of ₹900 · Remaining: ₹750");
  });

  it("calculates 50% advance verified payment correctly", () => {
    const project = { totalPrice: 1000, advanceAmount: 500, remainingAmount: 500 };
    const payments: ProjectPaymentItem[] = [
      {
        id: "pay-1",
        type: "ADVANCE",
        status: "VERIFIED",
        expectedAmount: 500,
        submittedAmount: 500,
      },
    ];

    const summary = computePaymentSummary(project, payments);
    expect(summary.totalPrice).toBe(1000);
    expect(summary.amountPaidSoFar).toBe(500);
    expect(summary.remainingBalance).toBe(500);
    expect(summary.advancePaid).toBe(true);
    expect(summary.finalPaid).toBe(false);
    expect(summary.displayText).toBe("Paid: ₹500 of ₹1,000 · Remaining: ₹500");
  });

  it("sums both advance and final when both are verified", () => {
    const project = { totalPrice: 1200, advanceAmount: 600, remainingAmount: 600 };
    const payments: ProjectPaymentItem[] = [
      {
        id: "pay-1",
        type: "ADVANCE",
        status: "VERIFIED",
        expectedAmount: 600,
        submittedAmount: 600,
      },
      {
        id: "pay-2",
        type: "FINAL",
        status: "VERIFIED",
        expectedAmount: 600,
        submittedAmount: 600,
      },
    ];

    const summary = computePaymentSummary(project, payments);
    expect(summary.totalPrice).toBe(1200);
    expect(summary.amountPaidSoFar).toBe(1200);
    expect(summary.remainingBalance).toBe(0);
    expect(summary.advancePaid).toBe(true);
    expect(summary.finalPaid).toBe(true);
    expect(summary.displayText).toBe("Paid: ₹1,200 of ₹1,200 · Remaining: ₹0");
  });

  it("ignores non-VERIFIED payments (AWAITING, SUBMITTED, REJECTED)", () => {
    const project = { totalPrice: 800, advanceAmount: 400, remainingAmount: 400 };
    const payments: ProjectPaymentItem[] = [
      {
        id: "pay-1",
        type: "ADVANCE",
        status: "SUBMITTED",
        expectedAmount: 400,
        submittedAmount: 400,
      },
      {
        id: "pay-2",
        type: "ADVANCE",
        status: "REJECTED",
        expectedAmount: 400,
        submittedAmount: 400,
      },
    ];

    const summary = computePaymentSummary(project, payments);
    expect(summary.totalPrice).toBe(800);
    expect(summary.amountPaidSoFar).toBe(0);
    expect(summary.remainingBalance).toBe(800);
    expect(summary.advancePaid).toBe(false);
    expect(summary.displayText).toBe("Paid: ₹0 of ₹800 · Remaining: ₹800");
  });

  it("handles project without accepted quote (totalPrice is null)", () => {
    const project = { totalPrice: null, advanceAmount: null, remainingAmount: null };
    const payments: ProjectPaymentItem[] = [];

    const summary = computePaymentSummary(project, payments);
    expect(summary.totalPrice).toBeNull();
    expect(summary.amountPaidSoFar).toBe(0);
    expect(summary.remainingBalance).toBeNull();
    expect(summary.displayText).toBe("Paid: ₹0 · Price quote pending agreement");
  });
});
