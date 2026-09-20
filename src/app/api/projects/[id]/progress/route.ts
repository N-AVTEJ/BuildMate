import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  progressUpdates,
  projectStatusHistory,
  notifications,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize, isProjectParticipant } from "@/lib/authorization";
import { computeEffectiveStatus } from "@/lib/project-status";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    authorize(auth, "PROJECT_UPDATE_PROGRESS");

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const rawNote = body?.note;

    if (
      typeof rawNote !== "string" ||
      rawNote.trim().length === 0 ||
      rawNote.trim().length > 2000
    ) {
      return NextResponse.json(
        { error: "A progress update note between 1 and 2000 characters is required." },
        { status: 400 }
      );
    }

    const note = rawNote.trim();
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

      // 2. Ownership verification via centralized authorization
      authorize(auth, "PROJECT_UPDATE_PROGRESS", { builderId: project.builderId });

      // 3. Central status engine evaluation
      const effective = computeEffectiveStatus(project, now);

      if (effective.status === "OVERDUE") {
        // Recovery guard: allow recovery ONLY when reason === "PROGRESS_UPDATE_ABANDONED" and now <= developmentDeadline
        if (
          effective.reason === "DEVELOPMENT_DEADLINE_EXPIRED" ||
          (project.developmentDeadline && now > project.developmentDeadline)
        ) {
          return {
            type: "CONFLICT" as const,
            message:
              "Development deadline has expired. Progress updates cannot restore project to IN_PROGRESS without administrative deadline extension.",
          };
        }

        if (effective.reason === "PROGRESS_UPDATE_ABANDONED") {
          // Recover project from OVERDUE back to IN_PROGRESS
          await tx
            .update(projects)
            .set({
              status: "IN_PROGRESS",
              lastProgressUpdateAt: now,
              overdueNotificationSentAt: null,
              updatedAt: now,
            })
            .where(eq(projects.id, projectId));

          await tx.insert(projectStatusHistory).values({
            projectId: project.id,
            fromStatus: "OVERDUE",
            toStatus: "IN_PROGRESS",
            changedBy: auth.user.id,
          });
        }
      } else if (effective.status === "IN_PROGRESS") {
        // Active development: touch lastProgressUpdateAt
        await tx
          .update(projects)
          .set({
            lastProgressUpdateAt: now,
            updatedAt: now,
          })
          .where(eq(projects.id, projectId));
      } else {
        // Any other state (AVAILABLE, AWAITING_ADVANCE, etc.)
        return {
          type: "BAD_REQUEST" as const,
          message: "Progress updates are only permitted during active development.",
        };
      }

      // 4. Record progress update entry
      const [newUpdate] = await tx
        .insert(progressUpdates)
        .values({
          projectId: project.id,
          builderId: auth.user.id,
          note,
          createdAt: now,
        })
        .returning();

      // 5. Notify client
      await tx.insert(notifications).values({
        userId: project.clientId,
        message: `Builder posted a progress update for "${project.title}".`,
      });

      return {
        type: "SUCCESS" as const,
        progressUpdate: newUpdate,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (result.type === "CONFLICT") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    if (result.type === "BAD_REQUEST") {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      progressUpdate: result.progressUpdate,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Progress/POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while posting progress update." },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();

    const { id: projectId } = await params;
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const [project] = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        builderId: projects.builderId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Must be client, assigned builder, or admin
    if (!isProjectParticipant(auth.user, auth.roles, project)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const updates = await db
      .select()
      .from(progressUpdates)
      .where(eq(progressUpdates.projectId, projectId))
      .orderBy(desc(progressUpdates.createdAt));

    return NextResponse.json({
      progressUpdates: updates,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Progress/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving progress updates." },
      { status: 500 }
    );
  }
}
