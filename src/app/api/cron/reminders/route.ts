import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { reconcileProjectStatusInDb } from "@/lib/project-status";
import { reconcilePaymentReminders } from "@/lib/projects/payment-reminders";

export const dynamic = "force-dynamic";

/**
 * Secured cron endpoint for periodic status reconciliation and deadline/payment reminders.
 * Can be triggered via Vercel Cron with:
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();

    // Strictly enforce CRON_SECRET authorization (prevent unauthorized invocation)
    if (process.env.NODE_ENV === "production" && !cronSecret) {
      console.error("[Cron/Reminders] CRON_SECRET is not configured in production environment.");
      return NextResponse.json({ error: "Cron endpoint unavailable." }, { status: 503 });
    }

    if (cronSecret || process.env.NODE_ENV === "production") {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const now = new Date();

    // Query active projects eligible for status transition or reminders
    const activeProjects = await db
      .select({
        id: projects.id,
        projectCode: projects.projectCode,
        title: projects.title,
        status: projects.status,
        clientId: projects.clientId,
        advancePaymentDeadline: projects.advancePaymentDeadline,
        advanceReminderSentAt: projects.advanceReminderSentAt,
        finalAdvanceReminderSentAt: projects.finalAdvanceReminderSentAt,
      })
      .from(projects)
      .where(
        inArray(projects.status, [
          "AVAILABLE",
          "AWAITING_ADVANCE",
          "IN_PROGRESS",
        ])
      );

    let reconciledCount = 0;
    let paymentReminderCount = 0;

    for (const proj of activeProjects) {
      try {
        await reconcileProjectStatusInDb(proj.id, now);
        reconciledCount++;

        if (proj.status === "AWAITING_ADVANCE") {
          await reconcilePaymentReminders(proj, now);
          paymentReminderCount++;
        }
      } catch (err) {
        console.warn(`[Cron/Reminders] Failed processing project ${proj.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      activeProjectsCount: activeProjects.length,
      reconciledCount,
      paymentReminderCount,
    });
  } catch (error) {
    console.error("[Cron/Reminders] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal error processing cron reminders." },
      { status: 500 }
    );
  }
}
