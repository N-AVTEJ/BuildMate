import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects, payments } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { getRazorpayClient } from "@/lib/payments/razorpay";

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
    const rawExpectedAmount =
      paymentType === "ADVANCE" ? project.advanceAmount : project.remainingAmount;

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

    // 4. Create Order with Razorpay SDK
    const razorpay = getRazorpayClient();
    const cleanReceipt = `${project.projectCode}-${paymentType}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);

    let order: any;
    try {
      order = await razorpay.orders.create({
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
      if (rzpErr?.statusCode === 401 || rzpErr?.error?.code === "BAD_REQUEST_ERROR") {
        return NextResponse.json(
          { error: "Payment gateway authentication failed. Check credentials." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Unable to create payment order with payment gateway. Please try again." },
        { status: 500 }
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
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;

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
