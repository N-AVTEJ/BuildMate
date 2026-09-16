import { NextResponse } from "next/server";
import { eq, and, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectStatusHistory } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { computeEffectiveStatus, SYSTEM_ACTOR_ID, ensureSystemActor } from "@/lib/project-status";
import { detectProjectSimilarity } from "@/lib/projects/similarity";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate Session
    const auth = await requireAuth();

    // 2. Authorize Action
    authorize(auth, "PROJECT_ACCEPT", { isEmailVerified: auth.user.emailVerified });

    // 3. Resolve Project ID
    const { id: projectId } = await params;

    // Parse Confirmation Payload
    const body = await req.json().catch(() => ({}));
    const confirmed = body?.confirmed === true;

    const now = new Date();

    // 4. Transactional Acceptance with Serialized/Locked Evaluation
    const result = await db.transaction(async (tx) => {
      // 4.1 Lock the project row for update
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update");

      if (!project) {
        return { type: "NOT_FOUND" as const };
      }

      // 4.2 Check effective status & expiry
      const effective = computeEffectiveStatus(project, now);

      if (effective.changed) {
        // Lazily reconcile to EXPIRED_NO_BUILDER
        const [updatedExpired] = await tx
          .update(projects)
          .set({
            status: "EXPIRED_NO_BUILDER",
            updatedAt: now,
          })
          .where(
            and(
              eq(projects.id, projectId),
              eq(projects.status, "AVAILABLE")
            )
          )
          .returning({ id: projects.id, clientId: projects.clientId });

        if (updatedExpired) {
          await ensureSystemActor(tx);
          await tx.insert(projectStatusHistory).values({
            projectId: updatedExpired.id,
            fromStatus: "AVAILABLE",
            toStatus: "EXPIRED_NO_BUILDER",
            changedBy: SYSTEM_ACTOR_ID,
          });
        }

        return { type: "EXPIRED" as const };
      }

      if (project.status !== "AVAILABLE") {
        return { type: "NOT_AVAILABLE" as const };
      }

      // 4.3 Duplicate Active Project Check
      // Look for active projects already assigned to this builder
      const activeProjects = await tx
        .select({
          id: projects.id,
          projectCode: projects.projectCode,
          title: projects.title,
          techStack: projects.techStack,
          status: projects.status,
        })
        .from(projects)
        .where(
          and(
            eq(projects.builderId, auth.user.id),
            inArray(projects.status, ["ADVANCE_VERIFIED", "IN_PROGRESS"])
          )
        );

      const conflicts: Array<{
        id: string;
        projectCode: string;
        title: string;
        status: string;
      }> = [];

      for (const active of activeProjects) {
        const sim = detectProjectSimilarity(
          { title: project.title, techStack: project.techStack },
          { title: active.title, techStack: active.techStack }
        );
        if (sim.isSimilar) {
          conflicts.push({
            id: active.id,
            projectCode: active.projectCode,
            title: active.title,
            status: active.status,
          });
        }
      }

      // If similar active project found and not explicitly confirmed: return warning without acquisition
      if (conflicts.length > 0 && !confirmed) {
        return {
          type: "WARNING_SIMILAR" as const,
          conflicts,
        };
      }

      // 4.4 Atomic Concurrency-Safe Conditional Acquisition
      const [acquiredProject] = await tx
        .update(projects)
        .set({
          builderId: auth.user.id, // Strictly session-derived
          builderAcceptedAt: now, // Server-controlled timestamp
          status: "ACCEPTED_PENDING_QUOTE",
          updatedAt: now,
        })
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.status, "AVAILABLE"),
            gt(projects.acceptanceDeadline, now),
            // Ensure no builder has acquired this project
            isNull(projects.builderId)
          )
        )
        .returning();

      if (!acquiredProject) {
        // Concurrency collision: another builder won the race or deadline lapsed
        return { type: "RACE_LOST" as const };
      }

      // 4.5 Insert Status Transition History (AVAILABLE -> ACCEPTED_PENDING_QUOTE)
      await tx.insert(projectStatusHistory).values({
        projectId: acquiredProject.id,
        fromStatus: "AVAILABLE",
        toStatus: "ACCEPTED_PENDING_QUOTE",
        changedBy: auth.user.id,
      });

      return {
        type: "SUCCESS" as const,
        project: acquiredProject,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (result.type === "EXPIRED") {
      return NextResponse.json(
        { error: "The acceptance deadline for this project has expired." },
        { status: 400 }
      );
    }

    if (result.type === "NOT_AVAILABLE" || result.type === "RACE_LOST") {
      return NextResponse.json(
        { error: "This project is no longer available for acceptance or was already acquired." },
        { status: 409 }
      );
    }

    if (result.type === "WARNING_SIMILAR") {
      return NextResponse.json(
        {
          warning: true,
          code: "SIMILAR_ACTIVE_PROJECT",
          message: "You already have an active project with similar scope. Proceed anyway?",
          conflicts: result.conflicts,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      project: result.project,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/Accept] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while accepting the project." },
      { status: 500 }
    );
  }
}
