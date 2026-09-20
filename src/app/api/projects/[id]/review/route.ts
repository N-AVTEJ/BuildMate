import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  payments,
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
    authorize(auth, "PROJECT_REVIEW_DELIVERY");

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action !== "ACCEPT") {
      return NextResponse.json(
        { error: "Invalid action. Supported action is 'ACCEPT'." },
        { status: 400 }
      );
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
        return { type: "NOT_FOUND" as const };
      }

      // 2. Centralized authorization check
      authorize(auth, "PROJECT_REVIEW_DELIVERY", { clientId: project.clientId });

      // 3. Status checks
      if (project.status === "COMPLETED") {
        return {
          type: "CONFLICT" as const,
          message: "Project is already marked as COMPLETED.",
        };
      }

      if (
        project.status !== "DELIVERY_UNLOCKED" &&
        project.status !== "CLIENT_REVIEW"
      ) {
        return {
          type: "BAD_REQUEST" as const,
          message: `Cannot review project in ${project.status} status. Delivery must be unlocked first.`,
        };
      }

      // 4. Defense-in-depth: Re-verify FINAL payment is VERIFIED
      const [finalPayment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.projectId, project.id),
            eq(payments.type, "FINAL")
          )
        )
        .limit(1);

      if (!finalPayment || finalPayment.status !== "VERIFIED") {
        return {
          type: "FORBIDDEN" as const,
          message: "Cannot accept project before final payment has been verified.",
        };
      }

      // 5. Update project to COMPLETED
      const previousStatus = project.status;
      const [updatedProject] = await tx
        .update(projects)
        .set({
          status: "COMPLETED",
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(projects.id, project.id))
        .returning();

      // 6. Record status history
      await tx.insert(projectStatusHistory).values({
        projectId: project.id,
        fromStatus: previousStatus,
        toStatus: "COMPLETED",
        changedBy: auth.user.id,
      });

      // 7. Notify builder
      if (project.builderId) {
        await tx.insert(notifications).values({
          userId: project.builderId,
          message: `Project "${project.title}" (${project.projectCode}) has been accepted and marked COMPLETED by the client.`,
        });
      }

      // 8. Notify client
      await tx.insert(notifications).values({
        userId: project.clientId,
        message: `You have accepted project "${project.title}". Project is now COMPLETED.`,
      });

      return {
        type: "SUCCESS" as const,
        project: updatedProject,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (result.type === "FORBIDDEN") {
      return NextResponse.json(
        { error: result.message || "Forbidden." },
        { status: 403 }
      );
    }

    if (result.type === "CONFLICT") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    if (result.type === "BAD_REQUEST") {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      project: result.project,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Review/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while reviewing project." },
      { status: 500 }
    );
  }
}
