import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  projectStatusHistory,
  disputes,
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
    authorize(auth, "ADMIN_RESOLVE_OVERDUE");

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const rawReason = body?.reason;
    const rawExtensionDays = body?.extensionDays;

    if (action !== "EXTEND" && action !== "DISPUTE") {
      return NextResponse.json(
        { error: "action must be either EXTEND or DISPUTE." },
        { status: 400 }
      );
    }

    if (
      typeof rawReason !== "string" ||
      rawReason.trim().length === 0 ||
      rawReason.trim().length > 500
    ) {
      return NextResponse.json(
        { error: "A reason between 1 and 500 characters is required." },
        { status: 400 }
      );
    }

    if (action === "EXTEND") {
      if (
        typeof rawExtensionDays !== "number" ||
        !Number.isInteger(rawExtensionDays) ||
        rawExtensionDays < 1 ||
        rawExtensionDays > 90
      ) {
        return NextResponse.json(
          { error: "extensionDays must be an integer between 1 and 90." },
          { status: 400 }
        );
      }
    }

    const reason = rawReason.trim();
    const extensionDays = rawExtensionDays as number;
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
        return { type: "NOT_FOUND" as const };
      }

      // 2. Concurrency-safe status check: verify project is actually OVERDUE
      if (project.status !== "OVERDUE") {
        return {
          type: "CONFLICT" as const,
          message: `Project is no longer in OVERDUE status (current status: ${project.status}).`,
        };
      }

      if (action === "EXTEND") {
        // Calculate new development deadline
        const baseTime =
          project.developmentDeadline &&
          project.developmentDeadline.getTime() > now.getTime()
            ? project.developmentDeadline.getTime()
            : now.getTime();
        const newDeadline = new Date(
          baseTime + extensionDays * 24 * 60 * 60 * 1000
        );

        // Update project: restore IN_PROGRESS, update deadline, reset progress & overdue tracking
        const [updatedProject] = await tx
          .update(projects)
          .set({
            status: "IN_PROGRESS",
            developmentDeadline: newDeadline,
            lastProgressUpdateAt: now,
            overdueNotificationSentAt: null,
            updatedAt: now,
          })
          .where(eq(projects.id, projectId))
          .returning();

        // Record status history transition
        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: "OVERDUE",
          toStatus: "IN_PROGRESS",
          changedBy: auth.user.id,
        });

        // Notifications
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Project "${project.title}" development deadline extended by ${extensionDays} days (${reason}).`,
        });

        if (project.builderId) {
          await tx.insert(notifications).values({
            userId: project.builderId,
            message: `Development deadline for "${project.title}" extended by ${extensionDays} days (${reason}).`,
          });
        }

        return {
          type: "SUCCESS" as const,
          action: "EXTEND" as const,
          project: updatedProject,
        };
      } else {
        // Action === "DISPUTE"
        // Insert disputes record
        const [dispute] = await tx
          .insert(disputes)
          .values({
            projectId: project.id,
            raisedBy: auth.user.id,
            reason: "BUILDER_UNRESPONSIVE",
            description: reason,
            status: "OPEN",
          })
          .returning();

        // Update project status to DISPUTE_OPEN
        const [updatedProject] = await tx
          .update(projects)
          .set({
            status: "DISPUTE_OPEN",
            updatedAt: now,
          })
          .where(eq(projects.id, projectId))
          .returning();

        // Record status history transition
        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: "OVERDUE",
          toStatus: "DISPUTE_OPEN",
          changedBy: auth.user.id,
        });

        // Notifications
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Project "${project.title}" has been moved to dispute resolution (${reason}).`,
        });

        if (project.builderId) {
          await tx.insert(notifications).values({
            userId: project.builderId,
            message: `Project "${project.title}" has been placed in dispute status (${reason}).`,
          });
        }

        return {
          type: "SUCCESS" as const,
          action: "DISPUTE" as const,
          dispute,
          project: updatedProject,
        };
      }
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (result.type === "CONFLICT") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      action: result.action,
      project: result.project,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/ResolveOverdue/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while resolving overdue project." },
      { status: 500 }
    );
  }
}
