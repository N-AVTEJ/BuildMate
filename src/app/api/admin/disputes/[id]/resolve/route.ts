import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  disputes,
  deliverables,
  payments,
  projectStatusHistory,
  notifications,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { validateAdminResolution } from "@/lib/projects/dispute-validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "ADMIN_RESOLVE_DISPUTE");

    const { id: disputeId } = await params;
    if (!disputeId || typeof disputeId !== "string") {
      return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const validation = validateAdminResolution(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { action, targetStatus, resolutionNote } = validation.data;
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Concurrency: Lock dispute row FOR UPDATE
      const [dispute] = await tx
        .select()
        .from(disputes)
        .where(eq(disputes.id, disputeId))
        .for("update")
        .limit(1);

      if (!dispute) {
        return { type: "NOT_FOUND" as const, message: "Dispute not found." };
      }

      // 2. Concurrency: Lock project row FOR UPDATE inside the same transaction
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, dispute.projectId))
        .for("update")
        .limit(1);

      if (!project) {
        return { type: "NOT_FOUND" as const, message: "Associated project not found." };
      }

      // 3. Concurrency check: Ensure dispute is still OPEN and project is DISPUTE_OPEN
      if (dispute.status !== "OPEN") {
        return {
          type: "CONFLICT" as const,
          message: `Conflict: This dispute is already in ${dispute.status} status and cannot be resolved again.`,
        };
      }

      if (project.status !== "DISPUTE_OPEN") {
        return {
          type: "CONFLICT" as const,
          message: `Conflict: Project is currently in ${project.status} status (expected DISPUTE_OPEN).`,
        };
      }

      // 4. Invariant 6 & 7: RETURN_TO_DELIVERY requires verified FINAL payment and deliverable
      if (action === "RETURN_TO_DELIVERY") {
        const [deliverableRow] = await tx
          .select({ id: deliverables.id })
          .from(deliverables)
          .where(eq(deliverables.projectId, project.id))
          .limit(1);

        if (!deliverableRow) {
          return {
            type: "CONFLICT" as const,
            message:
              "Cannot resolve dispute to DELIVERY_UNLOCKED: No deliverables have been submitted for this project.",
          };
        }

        const [finalPaymentRow] = await tx
          .select({
            id: payments.id,
            status: payments.status,
          })
          .from(payments)
          .where(
            and(
              eq(payments.projectId, project.id),
              eq(payments.type, "FINAL")
            )
          )
          .limit(1);

        if (!finalPaymentRow || finalPaymentRow.status !== "VERIFIED") {
          return {
            type: "CONFLICT" as const,
            message:
              "Cannot resolve dispute to DELIVERY_UNLOCKED: Final payment has not been verified.",
          };
        }
      }

      // 5. Invariant 3: Update dispute to RESOLVED
      const [resolvedDispute] = await tx
        .update(disputes)
        .set({
          status: "RESOLVED",
          resolvedBy: auth.user.id,
          resolvedAt: now,
          resolutionNote,
          updatedAt: now,
        })
        .where(eq(disputes.id, dispute.id))
        .returning();

      // 6. Update project to allowlisted targetStatus
      const [updatedProject] = await tx
        .update(projects)
        .set({
          status: targetStatus,
          updatedAt: now,
        })
        .where(eq(projects.id, project.id))
        .returning();

      // 7. Invariant 9: project_status_history creation with resolution note
      await tx.insert(projectStatusHistory).values({
        projectId: project.id,
        fromStatus: "DISPUTE_OPEN",
        toStatus: targetStatus,
        changedBy: auth.user.id,
        reason: `Admin dispute resolution (${action}): ${resolutionNote}`,
        createdAt: now,
        updatedAt: now,
      });

      // 8. Invariant 10: Atomic notifications
      const notificationMsg = `Dispute on "${project.title}" (${project.projectCode}) was resolved by admin: ${resolutionNote}. Project status set to ${targetStatus}.`;

      await tx.insert(notifications).values({
        userId: project.clientId,
        message: notificationMsg,
        createdAt: now,
        updatedAt: now,
      });

      if (project.builderId) {
        await tx.insert(notifications).values({
          userId: project.builderId,
          message: notificationMsg,
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        type: "SUCCESS" as const,
        dispute: resolvedDispute,
        project: updatedProject,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    if (result.type === "CONFLICT") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      dispute: result.dispute,
      project: result.project,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/Disputes/Resolve/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while resolving dispute." },
      { status: 500 }
    );
  }
}
