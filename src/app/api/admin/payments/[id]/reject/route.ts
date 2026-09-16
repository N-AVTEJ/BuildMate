import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  payments,
  projects,
  projectStatusHistory,
  notifications,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "ADMIN_PAYMENT_REJECT");

    const { id: paymentId } = await params;
    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { rejectionReason } = body || {};
    if (
      !rejectionReason ||
      typeof rejectionReason !== "string" ||
      rejectionReason.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "A rejection reason must be provided." },
        { status: 400 }
      );
    }

    const now = new Date();

    const txResult = await db.transaction(async (tx) => {
      // 1. Lock payment row
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .for("update")
        .limit(1);

      if (!payment) {
        return { type: "NOT_FOUND" as const };
      }

      // 2. Validate payment status
      if (
        payment.status !== "PROOF_SUBMITTED" &&
        payment.status !== "LATE_PAYMENT_PROOF"
      ) {
        return {
          type: "CONFLICT" as const,
          message: `Cannot reject payment with status ${payment.status}. Must be PROOF_SUBMITTED or LATE_PAYMENT_PROOF.`,
        };
      }

      // 3. Lock associated project row
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, payment.projectId))
        .for("update")
        .limit(1);

      if (!project) {
        return { type: "NOT_FOUND" as const };
      }

      // 4. Update payment to REJECTED
      const [rejectedPayment] = await tx
        .update(payments)
        .set({
          status: "REJECTED",
          rejectionReason: rejectionReason.trim(),
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id))
        .returning();

      // 5. Update project status to PAYMENT_REJECTED
      if (payment.type === "ADVANCE") {
        const initialStatus = project.status;
        await tx
          .update(projects)
          .set({
            status: "PAYMENT_REJECTED",
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: initialStatus,
          toStatus: "PAYMENT_REJECTED",
          changedBy: auth.user.id,
        });
      }

      // 6. Notify client of rejection with reason
      await tx.insert(notifications).values({
        userId: project.clientId,
        message: `Your payment proof for project "${project.title}" (${project.projectCode}) was rejected: "${rejectionReason.trim()}". Please review the payment info and submit a new proof.`,
        read: false,
      });

      return {
        type: "SUCCESS" as const,
        payment: rejectedPayment,
      };
    });

    if (txResult.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Payment or project not found." }, { status: 404 });
    }

    if (txResult.type === "CONFLICT") {
      return NextResponse.json({ error: txResult.message }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      payment: txResult.payment,
      message: "Payment rejected successfully.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/Payments/Reject] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while rejecting payment." },
      { status: 500 }
    );
  }
}
