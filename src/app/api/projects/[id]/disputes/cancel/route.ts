import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  disputes,
  projectStatusHistory,
  notifications,
  userRoles,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { ProjectStatus } from "@/lib/project-status";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id: projectId } = await params;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Lock and re-read project row FOR UPDATE
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update")
        .limit(1);

      if (!project) {
        return { type: "NOT_FOUND" as const, message: "Project not found." };
      }

      // 2. Lock and re-read the open dispute row
      const [dispute] = await tx
        .select()
        .from(disputes)
        .where(
          and(
            eq(disputes.projectId, project.id),
            eq(disputes.status, "OPEN")
          )
        )
        .for("update")
        .limit(1);

      if (!dispute) {
        return {
          type: "NOT_FOUND" as const,
          message: "No active OPEN dispute found for this project.",
        };
      }

      // 3. Invariant 4: Only the dispute raiser can withdraw an OPEN dispute
      if (dispute.raisedBy !== auth.user.id) {
        return {
          type: "FORBIDDEN" as const,
          message: "Forbidden: Only the party who raised the dispute can withdraw it.",
        };
      }

      // 4. Determine restored project status from locked preDisputeStatus
      const restoredStatus = (dispute.preDisputeStatus || "IN_PROGRESS") as ProjectStatus;

      // 5. Update dispute status to CANCELLED
      const [cancelledDispute] = await tx
        .update(disputes)
        .set({
          status: "CANCELLED",
          updatedAt: now,
        })
        .where(eq(disputes.id, dispute.id))
        .returning();

      // 6. Restore project status
      const [updatedProject] = await tx
        .update(projects)
        .set({
          status: restoredStatus,
          updatedAt: now,
        })
        .where(eq(projects.id, project.id))
        .returning();

      // 7. Invariant 9: project_status_history creation
      await tx.insert(projectStatusHistory).values({
        projectId: project.id,
        fromStatus: "DISPUTE_OPEN",
        toStatus: restoredStatus,
        changedBy: auth.user.id,
        reason: "Dispute withdrawn by raiser. Restored pre-dispute status.",
        createdAt: now,
        updatedAt: now,
      });

      // 8. Invariant 10: Atomic notifications
      // Notify Admin(s)
      const adminUsers = await tx
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.role, "ADMIN"));

      for (const admin of adminUsers) {
        await tx.insert(notifications).values({
          userId: admin.userId,
          message: `Dispute on "${project.title}" (${project.projectCode}) was withdrawn by raiser. Project restored to ${restoredStatus}.`,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Notify the other party
      if (auth.user.id === project.clientId && project.builderId) {
        await tx.insert(notifications).values({
          userId: project.builderId,
          message: `Client has withdrawn their dispute on "${project.title}". Project restored to ${restoredStatus}.`,
          createdAt: now,
          updatedAt: now,
        });
      } else if (auth.user.id === project.builderId) {
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Builder has withdrawn their dispute on "${project.title}". Project restored to ${restoredStatus}.`,
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        type: "SUCCESS" as const,
        dispute: cancelledDispute,
        project: updatedProject,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    if (result.type === "FORBIDDEN") {
      return NextResponse.json({ error: result.message }, { status: 403 });
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
    console.error("[Projects/Disputes/Cancel/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while withdrawing dispute." },
      { status: 500 }
    );
  }
}
