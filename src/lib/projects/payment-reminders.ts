import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { projects, notifications } from "@/db/schema";

export interface ProjectReminderInput {
  id: string;
  clientId: string;
  title: string;
  projectCode: string;
  status: string;
  advancePaymentDeadline: Date | null;
  advanceReminderSentAt?: Date | null;
  finalAdvanceReminderSentAt?: Date | null;
}

export type ReminderDecision =
  | { shouldSend: false }
  | { shouldSend: true; level: "12H" }
  | { shouldSend: true; level: "2H" };

/**
 * Pure function to determine whether a reminder should be triggered.
 * Used for unit testing without database side-effects.
 */
export function computePaymentReminderDecision(
  project: ProjectReminderInput,
  now: Date = new Date()
): ReminderDecision {
  if (project.status !== "AWAITING_ADVANCE") {
    return { shouldSend: false };
  }

  if (!project.advancePaymentDeadline) {
    return { shouldSend: false };
  }

  const remainingMs = project.advancePaymentDeadline.getTime() - now.getTime();

  // If deadline has already passed or is not in upcoming window
  if (remainingMs <= 0) {
    return { shouldSend: false };
  }

  // <2h window
  if (remainingMs < 2 * 3600 * 1000) {
    if (!project.finalAdvanceReminderSentAt) {
      return { shouldSend: true, level: "2H" };
    }
    return { shouldSend: false };
  }

  // <12h window
  if (remainingMs < 12 * 3600 * 1000) {
    if (!project.advanceReminderSentAt) {
      return { shouldSend: true, level: "12H" };
    }
    return { shouldSend: false };
  }

  return { shouldSend: false };
}

/**
 * Race-safe, transactional reconciliation for advance payment reminders.
 * Uses atomic conditional updates (WHERE column IS NULL) to ensure that
 * concurrent requests never send duplicate reminder notifications.
 */
export async function reconcilePaymentReminders(
  project: ProjectReminderInput,
  now: Date = new Date()
): Promise<void> {
  const decision = computePaymentReminderDecision(project, now);
  if (!decision.shouldSend) return;

  if (decision.level === "2H") {
    // Atomic check-and-set for <2h reminder
    const [updated] = await db
      .update(projects)
      .set({
        finalAdvanceReminderSentAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(projects.id, project.id),
          isNull(projects.finalAdvanceReminderSentAt)
        )
      )
      .returning({ id: projects.id });

    if (updated) {
      await db.insert(notifications).values({
        userId: project.clientId,
        message: `Urgent: Less than 2 hours remaining to submit advance payment for project "${project.title}" (${project.projectCode}).`,
        read: false,
      });
    }
  } else if (decision.level === "12H") {
    // Atomic check-and-set for <12h reminder
    const [updated] = await db
      .update(projects)
      .set({
        advanceReminderSentAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(projects.id, project.id),
          isNull(projects.advanceReminderSentAt)
        )
      )
      .returning({ id: projects.id });

    if (updated) {
      await db.insert(notifications).values({
        userId: project.clientId,
        message: `Reminder: Advance payment deadline is approaching (less than 12 hours remaining) for project "${project.title}" (${project.projectCode}).`,
        read: false,
      });
    }
  }
}
