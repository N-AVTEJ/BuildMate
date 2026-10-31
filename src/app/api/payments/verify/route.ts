import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { db } from "@/db";
import {
  projects,
  payments,
  projectStatusHistory,
  notifications,
  quotations,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { fetchRazorpayOrder } from "@/lib/payments/razorpay";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();

    // 0. Rate limiting: protect payment verification from automated enumeration
    const clientIp = getClientIp(req);
    const rl = await rateLimit(`payments:verify:${auth.user.id}:${clientIp}`, 30, "1 m");
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many payment verification attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        {
          error:
            "Missing required payment verification parameters (razorpay_order_id, razorpay_payment_id, razorpay_signature).",
        },
        { status: 400 }
      );
    }

    // 1. Look up payment by razorpayOrderId
    const [paymentRecord] = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, razorpay_order_id))
      .limit(1);

    if (!paymentRecord) {
      return NextResponse.json(
        { error: "Payment order record not found." },
        { status: 404 }
      );
    }

    // 2. Fetch project and enforce client ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, paymentRecord.projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Associated project not found." }, { status: 404 });
    }

    if (project.clientId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this project." },
        { status: 403 }
      );
    }

    // 3. Cryptographic Signature Verification via HMAC-SHA256
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keySecret) {
      console.error("[Payments/Verify] RAZORPAY_KEY_SECRET is not configured.");
      return NextResponse.json(
        { error: "Server payment configuration error." },
        { status: 500 }
      );
    }

    const expectedSignatureHex = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // Strictly check buffer lengths equality first; timingSafeEqual throws if lengths mismatch
    let isSignatureValid = false;
    try {
      if (typeof razorpay_signature === "string" && /^[0-9a-fA-F]{64}$/.test(razorpay_signature)) {
        const expectedBuf = Buffer.from(expectedSignatureHex, "hex");
        const actualBuf = Buffer.from(razorpay_signature, "hex");

        if (expectedBuf.length > 0 && expectedBuf.length === actualBuf.length) {
          isSignatureValid = crypto.timingSafeEqual(expectedBuf, actualBuf);
        }
      }
    } catch {
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      // Record failed signature verification
      await db
        .update(payments)
        .set({
          status: "REJECTED",
          rejectionReason: "Invalid cryptographic payment signature.",
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentRecord.id));

      return NextResponse.json(
        {
          success: false,
          error: "Invalid payment signature. Verification failed.",
        },
        { status: 400 }
      );
    }

    // 4. Server-to-Server Confirmation: Re-fetch order from Razorpay API
    const expectedAmountPaise = paymentRecord.expectedAmount * 100;
    let rzpOrder: any;
    try {
      rzpOrder = await fetchRazorpayOrder(razorpay_order_id, expectedAmountPaise);
    } catch (orderFetchErr: any) {
      console.error("[Payments/Verify] Failed to re-fetch order from Razorpay API:", orderFetchErr);
      return NextResponse.json(
        {
          success: false,
          error: "Unable to cross-verify payment order with payment gateway.",
        },
        { status: 502 }
      );
    }

    // Cross-check order amount and status from payment gateway
    // In Razorpay's lifecycle, paid/attempted indicates actual captured/attempted funds; 'created' is unpaid
    const isAmountMatching = rzpOrder.amount === expectedAmountPaise;
    const isStatusAcceptable = ["paid", "attempted"].includes(rzpOrder.status);

    if (!isAmountMatching || !isStatusAcceptable) {
      console.error("[Payments/Verify] Razorpay gateway order mismatch:", {
        expectedAmountPaise,
        gatewayAmount: rzpOrder.amount,
        gatewayStatus: rzpOrder.status,
      });

      await db
        .update(payments)
        .set({
          status: "REJECTED",
          rejectionReason: `Gateway verification mismatch (Amount: ${rzpOrder.amount} vs ${expectedAmountPaise}, Status: ${rzpOrder.status}).`,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentRecord.id));

      return NextResponse.json(
        {
          success: false,
          error: "Payment verification failed: Gateway amount or status discrepancy.",
        },
        { status: 400 }
      );
    }

    // 4. Atomic Transition on Successful Signature Verification
    const now = new Date();
    let newProjectStatus: "IN_PROGRESS" | "DELIVERY_UNLOCKED" = "IN_PROGRESS";

    await db.transaction(async (tx) => {
      // A. Update payment status to VERIFIED
      await tx
        .update(payments)
        .set({
          status: "VERIFIED",
          verifiedAt: now,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          updatedAt: now,
        })
        .where(eq(payments.id, paymentRecord.id));

      if (paymentRecord.type === "ADVANCE") {
        newProjectStatus = "IN_PROGRESS";

        // Fetch accepted quotation duration
        const [acceptedQuote] = await tx
          .select({ estimatedDurationDays: quotations.estimatedDurationDays })
          .from(quotations)
          .where(
            and(
              eq(quotations.projectId, project.id),
              eq(quotations.status, "ACCEPTED")
            )
          )
          .limit(1);

        const durationDays = acceptedQuote?.estimatedDurationDays || 7;
        const developmentDeadline = new Date(
          now.getTime() + durationDays * 24 * 60 * 60 * 1000
        );

        // Update project state
        await tx
          .update(projects)
          .set({
            status: "IN_PROGRESS",
            advanceVerifiedAt: now,
            developmentStartedAt: now,
            developmentDeadline,
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        // Audit log
        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: project.status,
          toStatus: "IN_PROGRESS",
          changedBy: auth.user.id,
          reason: "Advance payment verified via Razorpay Standard Checkout",
        });

        // Notifications
        if (project.builderId) {
          await tx.insert(notifications).values({
            userId: project.builderId,
            message: `Advance payment verified for project ${project.projectCode}. Development is officially started!`,
          });
        }
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Advance payment verified for project ${project.projectCode}. Development has begun.`,
        });
      } else if (paymentRecord.type === "FINAL") {
        newProjectStatus = "DELIVERY_UNLOCKED";

        // Unlock delivery
        await tx
          .update(projects)
          .set({
            status: "DELIVERY_UNLOCKED",
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        // Audit log
        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: project.status,
          toStatus: "DELIVERY_UNLOCKED",
          changedBy: auth.user.id,
          reason: "Final payment verified via Razorpay Standard Checkout",
        });

        // Notifications
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Final payment verified for project ${project.projectCode}. Code repository delivery is now unlocked!`,
        });

        if (project.builderId) {
          await tx.insert(notifications).values({
            userId: project.builderId,
            message: `Final payment received and verified for project ${project.projectCode}.`,
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      new_status: newProjectStatus,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Payments/Verify] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during payment verification." },
      { status: 500 }
    );
  }
}
