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
import { validateDisputeSubmission } from "@/lib/projects/dispute-validation";
import { ProjectStatus } from "@/lib/project-status";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id: projectId } = await params;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Lock and re-read project row FOR UPDATE (Invariant 3)
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update")
        .limit(1);

      if (!project) {
        return { type: "NOT_FOUND" as const };
      }

      // 2. Ownership & role-based switch (Tasks 3 & 4)
      const isClient = project.clientId === auth.user.id;
      const isBuilder = project.builderId === auth.user.id;

      if (!isClient && !isBuilder) {
        return {
          type: "FORBIDDEN" as const,
          message: "Forbidden: Only the project client or assigned builder can open a dispute.",
        };
      }

      const role = isClient ? ("CLIENT" as const) : ("BUILDER" as const);

      // 3. Invariant 1: At most one OPEN dispute per project
      const [existingOpenDispute] = await tx
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

      if (existingOpenDispute || project.status === "DISPUTE_OPEN") {
        return {
          type: "CONFLICT" as const,
          message: "An active dispute is already open for this project.",
        };
      }

      // 4. Validate submission against role-specific reason & status allowlist
      const validation = validateDisputeSubmission(
        body,
        role,
        project.status as ProjectStatus
      );

      if (!validation.valid || !validation.data) {
        return {
          type: "BAD_REQUEST" as const,
          message: validation.error || "Invalid dispute submission.",
        };
      }

      const { reason, description } = validation.data;
      const preDisputeStatus = project.status as ProjectStatus;

      // 5. Invariant 2, 9, 10: Atomic dispute opening inside transaction
      const [newDispute] = await tx
        .insert(disputes)
        .values({
          projectId: project.id,
          raisedBy: auth.user.id,
          reason,
          description,
          status: "OPEN",
          preDisputeStatus,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // 6. Project status change to DISPUTE_OPEN
      const [updatedProject] = await tx
        .update(projects)
        .set({
          status: "DISPUTE_OPEN",
          updatedAt: now,
        })
        .where(eq(projects.id, project.id))
        .returning();

      // 7. Invariant 9: project_status_history creation
      await tx.insert(projectStatusHistory).values({
        projectId: project.id,
        fromStatus: preDisputeStatus,
        toStatus: "DISPUTE_OPEN",
        changedBy: auth.user.id,
        reason: `Dispute opened: ${reason} - ${description.slice(0, 200)}`,
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
          message: `Dispute opened on project "${project.title}" (${project.projectCode}) by ${role.toLowerCase()}. Reason: ${reason}.`,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Notify the other party
      if (isClient && project.builderId) {
        await tx.insert(notifications).values({
          userId: project.builderId,
          message: `Client opened a formal dispute on "${project.title}". Project is in DISPUTE_OPEN status pending administrator review.`,
          createdAt: now,
          updatedAt: now,
        });
      } else if (isBuilder) {
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Builder opened a formal dispute on "${project.title}". Project is in DISPUTE_OPEN status pending administrator review.`,
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        type: "SUCCESS" as const,
        dispute: newDispute,
        project: updatedProject,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (result.type === "FORBIDDEN") {
      return NextResponse.json({ error: result.message }, { status: 403 });
    }

    if (result.type === "CONFLICT") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    if (result.type === "BAD_REQUEST") {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        dispute: result.dispute,
        project: result.project,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Disputes/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while opening dispute." },
      { status: 500 }
    );
  }
}
