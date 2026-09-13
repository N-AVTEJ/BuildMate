import { eq, and, lt } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectStatusHistory, projectStatusEnum } from "@/db/schema";

export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export interface StatusProjectInput {
  status: ProjectStatus;
  acceptanceDeadline: Date | null;
}

/**
 * Pure function to derive effective project status based on current time.
 * If status is AVAILABLE and acceptanceDeadline < now → derives EXPIRED_NO_BUILDER.
 * Has zero side-effects and does not touch the database.
 */
export function computeEffectiveStatus(
  project: StatusProjectInput,
  now: Date = new Date()
): ProjectStatus {
  if (
    project.status === "AVAILABLE" &&
    project.acceptanceDeadline &&
    project.acceptanceDeadline < now
  ) {
    return "EXPIRED_NO_BUILDER";
  }
  return project.status;
}

/**
 * Transactional lazy expiry reconciliation.
 * When an AVAILABLE project's acceptance deadline has passed:
 * 1. Conditionally updates projects SET status = 'EXPIRED_NO_BUILDER' WHERE id = :id AND status = 'AVAILABLE' AND acceptance_deadline < now
 * 2. If update succeeded, inserts exactly one project_status_history entry (AVAILABLE -> EXPIRED_NO_BUILDER)
 * 
 * Concurrent requests result in exactly one successful status transition and one history record.
 */
export async function reconcileProjectStatusInDb(
  projectId: string,
  now: Date = new Date()
): Promise<ProjectStatus> {
  let finalStatus: ProjectStatus = "AVAILABLE";

  await db.transaction(async (tx) => {
    // 1. Fetch current status and deadline
    const [project] = await tx
      .select({
        id: projects.id,
        status: projects.status,
        acceptanceDeadline: projects.acceptanceDeadline,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return;
    }

    finalStatus = project.status;

    // 2. Check if expired
    if (
      project.status === "AVAILABLE" &&
      project.acceptanceDeadline &&
      project.acceptanceDeadline < now
    ) {
      // Conditionally update: only updates if status is still 'AVAILABLE'
      const [updated] = await tx
        .update(projects)
        .set({
          status: "EXPIRED_NO_BUILDER",
          updatedAt: now,
        })
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.status, "AVAILABLE"),
            lt(projects.acceptanceDeadline, now)
          )
        )
        .returning({
          id: projects.id,
          clientId: projects.clientId,
        });

      if (updated) {
        finalStatus = "EXPIRED_NO_BUILDER";
        await tx.insert(projectStatusHistory).values({
          projectId: updated.id,
          fromStatus: "AVAILABLE",
          toStatus: "EXPIRED_NO_BUILDER",
          changedBy: updated.clientId,
        });
      }
    }
  });

  return finalStatus;
}
