import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
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
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "ADMIN_PAYMENT_VERIFY");

    const { id: paymentId } = await params;
    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
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
          message: `Cannot verify payment with status ${payment.status}. Must be PROOF_SUBMITTED or LATE_PAYMENT_PROOF.`,
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

      // 4. Update payment to VERIFIED
      const [verifiedPayment] = await tx
        .update(payments)
        .set({
          status: "VERIFIED",
          verifiedAt: now,
          verifiedBy: auth.user.id,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id))
        .returning();

      // 5. Lifecycle transitions based on payment type
      if (payment.type === "ADVANCE") {
        const initialStatus = project.status;

        // Transition 1: Project -> ADVANCE_VERIFIED
        await tx
          .update(projects)
          .set({
            status: "ADVANCE_VERIFIED",
            advanceVerifiedAt: now,
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: initialStatus,
          toStatus: "ADVANCE_VERIFIED",
          changedBy: auth.user.id,
        });

        // Transition 2: Project -> IN_PROGRESS
        // Note: Phase 7 owns the formal development deadline engine.
        // developmentStartedAt is set to now; developmentDeadline remains null/unchanged.
        await tx
          .update(projects)
          .set({
            status: "IN_PROGRESS",
            developmentStartedAt: now,
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: "ADVANCE_VERIFIED",
          toStatus: "IN_PROGRESS",
          changedBy: auth.user.id,
        });

        // Cancel / mark-read any pending advance reminder notifications for client
        await tx
          .update(notifications)
          .set({
            read: true,
            updatedAt: now,
          })
          .where(
            and(
              eq(notifications.userId, project.clientId),
              eq(notifications.read, false),
              sql`${notifications.message} ILIKE '%advance%'`
            )
          );

        // Notify client
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Your advance payment of ₹${payment.expectedAmount} for project "${project.title}" (${project.projectCode}) has been verified. Development has started!`,
          read: false,
        });

        // Notify builder if assigned
        if (project.builderId) {
          await tx.insert(notifications).values({
            userId: project.builderId,
            message: `Advance payment of ₹${payment.expectedAmount} for project "${project.title}" (${project.projectCode}) has been verified. Development is now IN_PROGRESS.`,
            read: false,
          });
        }

        return {
          type: "SUCCESS" as const,
          payment: verifiedPayment,
          newProjectStatus: "IN_PROGRESS",
        };
      } else if (payment.type === "FINAL") {
        const initialStatus = project.status;

        // Transition: Project -> DELIVERY_UNLOCKED
        await tx
          .update(projects)
          .set({
            status: "DELIVERY_UNLOCKED",
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: initialStatus,
          toStatus: "DELIVERY_UNLOCKED",
          changedBy: auth.user.id,
        });

        // Notify client
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Your final payment of ₹${payment.expectedAmount} for project "${project.title}" (${project.projectCode}) has been verified. Delivery is now unlocked!`,
          read: false,
        });

        // Notify builder if assigned
        if (project.builderId) {
          await tx.insert(notifications).values({
            userId: project.builderId,
            message: `Final payment of ₹${payment.expectedAmount} for project "${project.title}" (${project.projectCode}) has been verified. Project delivery is unlocked.`,
            read: false,
          });
        }

        return {
          type: "SUCCESS" as const,
          payment: verifiedPayment,
          newProjectStatus: "DELIVERY_UNLOCKED",
        };
      }

      return {
        type: "CONFLICT" as const,
        message: "Unsupported payment type.",
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
      projectStatus: txResult.newProjectStatus,
      message: "Payment successfully verified.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/Payments/Verify] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while verifying payment." },
      { status: 500 }
    );
  }
}
