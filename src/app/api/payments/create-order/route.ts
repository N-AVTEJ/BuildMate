import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  payments,
  quotations,
  projectStatusHistory,
  notifications,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { createRazorpayOrder } from "@/lib/payments/razorpay";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { projectId } = body || {};

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    // 1. Fetch project and verify ownership (Client only)
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (project.clientId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to create payment orders for this project." },
        { status: 403 }
      );
    }

    // 2. Derive payment type from project status
    let paymentType: "ADVANCE" | "FINAL";
    if (
      project.status === "AWAITING_ADVANCE" ||
      project.status === "PAYMENT_REJECTED"
    ) {
      paymentType = "ADVANCE";
    } else if (
      project.status === "FINAL_PAYMENT_PENDING"
    ) {
      paymentType = "FINAL";
    } else {
      return NextResponse.json(
        { error: `Project is not currently awaiting payment (current status: ${project.status}).` },
        { status: 400 }
      );
    }

    // 3. Amount is NEVER accepted from client — strictly server-derived
    let rawExpectedAmount =
      paymentType === "ADVANCE" ? project.advanceAmount : project.remainingAmount;

    // Self-healing fallback: If project amounts are null, zero, or unconfigured, inspect accepted quotation
    if (
      rawExpectedAmount === null ||
      rawExpectedAmount === undefined ||
      typeof rawExpectedAmount !== "number" ||
      (paymentType === "ADVANCE" && rawExpectedAmount <= 0)
    ) {
      const [quote] = await db
        .select()
        .from(quotations)
        .where(
          and(
            eq(quotations.projectId, project.id),
            eq(quotations.status, "ACCEPTED")
          )
        )
        .orderBy(desc(quotations.createdAt))
        .limit(1);

      if (quote) {
        rawExpectedAmount =
          paymentType === "ADVANCE" ? quote.advanceAmount : quote.remainingAmount;

        // Persist healed pricing onto projects row
        await db
          .update(projects)
          .set({
            totalPrice: quote.totalPrice,
            advanceAmount: quote.advanceAmount,
            remainingAmount: quote.remainingAmount,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, project.id));
      }
    }

    // Zero Remaining Balance Handling for FINAL payment:
    // If remainingAmount is <= 0 (e.g. 100% advance deposit on projects <= 300),
    // no further client payment is required; automatically transition to DELIVERY_UNLOCKED.
    if (paymentType === "FINAL" && (rawExpectedAmount ?? 0) <= 0) {
      const now = new Date();
      await db.transaction(async (tx) => {
        const [existingFinalPayment] = await tx
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.projectId, project.id),
              eq(payments.type, "FINAL")
            )
          )
          .limit(1);

        if (existingFinalPayment) {
          await tx
            .update(payments)
            .set({
              status: "VERIFIED",
              expectedAmount: 0,
              submittedAmount: 0,
              transactionReference: "FULL_ADVANCE_SETTLED",
              verifiedAt: now,
              updatedAt: now,
            })
            .where(eq(payments.id, existingFinalPayment.id));
        } else {
          await tx.insert(payments).values({
            projectId: project.id,
            type: "FINAL",
            expectedAmount: 0,
            submittedAmount: 0,
            status: "VERIFIED",
            transactionReference: "FULL_ADVANCE_SETTLED",
            verifiedAt: now,
          });
        }

        await tx
          .update(projects)
          .set({
            status: "DELIVERY_UNLOCKED",
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: project.status,
          toStatus: "DELIVERY_UNLOCKED",
          changedBy: auth.user.id,
          reason: "Zero remaining balance. Final delivery unlocked automatically.",
        });

        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Deliverables ready for "${project.title}". Project total was fully covered by advance; delivery is unlocked!`,
        });
      });

      return NextResponse.json({
        success: true,
        zeroRemaining: true,
        newStatus: "DELIVERY_UNLOCKED",
        message: "No remaining payment required. Source code delivery is now unlocked!",
      });
    }

    if (
      rawExpectedAmount === null ||
      rawExpectedAmount === undefined ||
      typeof rawExpectedAmount !== "number" ||
      rawExpectedAmount <= 0 ||
      !Number.isInteger(rawExpectedAmount)
    ) {
      return NextResponse.json(
        { error: "Project payment amount is invalid or not configured." },
        { status: 409 }
      );
    }

    const amountInPaise = rawExpectedAmount * 100;

    // Minimum amount check: Razorpay requires at least 100 paise (₹1)
    if (amountInPaise < 100) {
      return NextResponse.json(
        { error: "Payment amount must be at least ₹1 (100 paise)." },
        { status: 400 }
      );
    }

    // 4. Create Order via Resilient Razorpay Client
    const cleanReceipt = `${project.projectCode}-${paymentType}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);

    let order: any;
    try {
      order = await createRazorpayOrder({
        amount: amountInPaise,
        currency: "INR",
        receipt: cleanReceipt,
        notes: {
          projectId: project.id,
          projectCode: project.projectCode,
          paymentType,
          clientId: auth.user.id,
        },
      });
    } catch (rzpErr: any) {
      console.error("[Razorpay/CreateOrder] Gateway Error:", rzpErr);
      const statusCode = rzpErr?.statusCode || 500;
      if (statusCode === 401) {
        return NextResponse.json(
          { error: "Payment gateway authentication failed. Check credentials." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: rzpErr?.message || "Unable to create payment order with payment gateway. Please try again." },
        { status: statusCode }
      );
    }

    // 5. Insert or update payments record
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.projectId, project.id), eq(payments.type, paymentType)))
      .limit(1);

    if (existingPayment) {
      await db
        .update(payments)
        .set({
          expectedAmount: rawExpectedAmount,
          razorpayOrderId: order.id,
          status: "ORDER_CREATED",
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existingPayment.id));
    } else {
      await db.insert(payments).values({
        projectId: project.id,
        type: paymentType,
        expectedAmount: rawExpectedAmount,
        razorpayOrderId: order.id,
        status: "ORDER_CREATED",
      });
    }

    const keyId =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
      process.env.RAZORPAY_KEY_ID?.trim();

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      paymentType,
      projectCode: project.projectCode,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Payments/CreateOrder] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while creating payment order." },
      { status: 500 }
    );
  }
}
