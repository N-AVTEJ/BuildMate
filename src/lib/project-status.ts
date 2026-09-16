import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  projectStatusHistory,
  projectStatusEnum,
  users,
  userRoles,
  notifications,
} from "@/db/schema";

export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Ensures the dedicated system actor user exists in the database.
 * This guarantees foreign key compatibility with project_status_history.changedBy
 * without falsely attributing system-generated status transitions to users.
 */
export async function ensureSystemActor(txOrDb: any = db): Promise<string> {
  await txOrDb
    .insert(users)
    .values({
      id: SYSTEM_ACTOR_ID,
      name: "System Engine",
      email: "system@buildmate.internal",
      passwordHash: "SYSTEM_NO_LOGIN",
      emailVerified: true,
    })
    .onConflictDoNothing();

  return SYSTEM_ACTOR_ID;
}

export interface StatusProjectInput {
  status: ProjectStatus;
  acceptanceDeadline?: Date | null;
  advancePaymentDeadline?: Date | null;
  developmentStartedAt?: Date | null;
  developmentDeadline?: Date | null;
  lastProgressUpdateAt?: Date | null;
}

export type EffectiveStatusReason =
  | "ACCEPTANCE_DEADLINE_EXPIRED"
  | "ADVANCE_PAYMENT_DEADLINE_EXPIRED"
  | "DEVELOPMENT_DEADLINE_EXPIRED"
  | "PROGRESS_UPDATE_ABANDONED";

export interface EffectiveStatusResult {
  status: ProjectStatus;
  changed: boolean;
  reason?: EffectiveStatusReason;
}

/**
 * Pure function to derive effective project status based on current time.
 * Has zero side-effects and does not touch the database.
 *
 * Evaluation rules (in strict priority order):
 * 1. AVAILABLE + acceptanceDeadline < now -> EXPIRED_NO_BUILDER
 * 2. AWAITING_ADVANCE + advancePaymentDeadline < now -> ADVANCE_PAYMENT_EXPIRED
 * 3. IN_PROGRESS:
 *    3a. developmentDeadline < now -> OVERDUE (DEVELOPMENT_DEADLINE_EXPIRED)
 *    3b. (now - lastActive) > 3 days -> OVERDUE (PROGRESS_UPDATE_ABANDONED)
 * 4. Default -> project.status unchanged
 */
export function computeEffectiveStatus(
  project: StatusProjectInput,
  now: Date = new Date()
): EffectiveStatusResult {
  // 1. Acceptance Deadline Expired
  if (
    project.status === "AVAILABLE" &&
    project.acceptanceDeadline &&
    now > project.acceptanceDeadline
  ) {
    return {
      status: "EXPIRED_NO_BUILDER",
      changed: true,
      reason: "ACCEPTANCE_DEADLINE_EXPIRED",
    };
  }

  // 2. Advance Payment Deadline Expired
  if (
    project.status === "AWAITING_ADVANCE" &&
    project.advancePaymentDeadline &&
    now > project.advancePaymentDeadline
  ) {
    return {
      status: "ADVANCE_PAYMENT_EXPIRED",
      changed: true,
      reason: "ADVANCE_PAYMENT_DEADLINE_EXPIRED",
    };
  }

  // 3. In Progress: Deadline or Inactivity Abandonment
  if (project.status === "IN_PROGRESS") {
    // 3a. Development deadline passed
    if (project.developmentDeadline && now > project.developmentDeadline) {
      return {
        status: "OVERDUE",
        changed: true,
        reason: "DEVELOPMENT_DEADLINE_EXPIRED",
      };
    }

    // 3b. Inactivity > 3 days (abandonment)
    const lastActive = project.lastProgressUpdateAt || project.developmentStartedAt;
    if (
      lastActive &&
      now.getTime() - lastActive.getTime() > 3 * 24 * 60 * 60 * 1000
    ) {
      return {
        status: "OVERDUE",
        changed: true,
        reason: "PROGRESS_UPDATE_ABANDONED",
      };
    }
  }

  // Default: no status change
  return {
    status: project.status,
    changed: false,
  };
}

/**
 * Transactional lazy status reconciliation using persist-on-read.
 * Locks the project row FOR UPDATE, re-evaluates computeEffectiveStatus,
 * and if status changed, atomically updates project status, records
 * project_status_history with SYSTEM_ACTOR_ID, and sends idempotent notifications.
 */
export async function reconcileProjectStatusInDb(
  projectId: string,
  now: Date = new Date()
): Promise<ProjectStatus> {
  let finalStatus: ProjectStatus = "AVAILABLE";

  await db.transaction(async (tx) => {
    // 1. Lock and re-read project row FOR UPDATE
    const [project] = await tx
      .select({
        id: projects.id,
        projectCode: projects.projectCode,
        title: projects.title,
        status: projects.status,
        clientId: projects.clientId,
        builderId: projects.builderId,
        acceptanceDeadline: projects.acceptanceDeadline,
        advancePaymentDeadline: projects.advancePaymentDeadline,
        developmentStartedAt: projects.developmentStartedAt,
        developmentDeadline: projects.developmentDeadline,
        lastProgressUpdateAt: projects.lastProgressUpdateAt,
        overdueNotificationSentAt: projects.overdueNotificationSentAt,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .for("update")
      .limit(1);

    if (!project) {
      return;
    }

    finalStatus = project.status;

    // 2. Evaluate status change
    const effective = computeEffectiveStatus(project, now);
    if (!effective.changed) {
      return;
    }

    // 3. Conditional update to guarantee winning race
    const shouldClaimOverdueNotification =
      effective.status === "OVERDUE" && !project.overdueNotificationSentAt;

    const [updated] = await tx
      .update(projects)
      .set({
        status: effective.status,
        updatedAt: now,
        ...(shouldClaimOverdueNotification
          ? { overdueNotificationSentAt: now }
          : {}),
      })
      .where(
        and(eq(projects.id, projectId), eq(projects.status, project.status))
      )
      .returning();

    if (updated) {
      finalStatus = effective.status;

      // Ensure system actor user exists for foreign key constraint
      await ensureSystemActor(tx);

      // Record status transition in history
      await tx.insert(projectStatusHistory).values({
        projectId: project.id,
        fromStatus: project.status,
        toStatus: effective.status,
        changedBy: SYSTEM_ACTOR_ID,
      });

      // If transition is to OVERDUE and notification was claimed, notify admins & client
      if (shouldClaimOverdueNotification) {
        // Admin notifications
        const admins = await tx
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(eq(userRoles.role, "ADMIN"));

        for (const admin of admins) {
          await tx.insert(notifications).values({
            userId: admin.userId,
            message: `Project "${project.title}" (${project.projectCode}) is now OVERDUE (${effective.reason}).`,
          });
        }

        // Client notification
        await tx.insert(notifications).values({
          userId: project.clientId,
          message: `Project "${project.title}" is overdue. Our administration team has been alerted.`,
        });
      }
    } else {
      // If we didn't update, fetch current status
      const [current] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, projectId));
      if (current) {
        finalStatus = current.status;
      }
    }
  });

  return finalStatus;
}
