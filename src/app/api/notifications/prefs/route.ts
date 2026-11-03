import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPrefs } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";

const updatePrefsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  quotationUpdates: z.boolean().optional(),
  paymentUpdates: z.boolean().optional(), // Cannot be turned off; will be coerced to true
  deliveryUpdates: z.boolean().optional(),
  deadlineAlerts: z.boolean().optional(),
  changeRequestUpdates: z.boolean().optional(),
  disputeUpdates: z.boolean().optional(),
  snoozeDays: z.number().int().min(1).max(365).optional(),
  clearSnooze: z.boolean().optional(),
});

export async function GET() {
  try {
    const auth = await requireAuth();

    const [prefs] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, auth.user.id))
      .limit(1);

    const defaultPrefs = {
      pushEnabled: true,
      quotationUpdates: true,
      paymentUpdates: true, // Always true (security/payment constraint)
      deliveryUpdates: true,
      deadlineAlerts: true,
      changeRequestUpdates: true,
      disputeUpdates: true,
      snoozedUntil: null,
    };

    return NextResponse.json({
      success: true,
      prefs: prefs || defaultPrefs,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Notifications/Prefs/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();

    const body = await req.json().catch(() => ({}));
    const parseResult = updatePrefsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid preference update payload." },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const now = new Date();

    let computedSnoozedUntil: Date | null | undefined = undefined;
    if (data.clearSnooze) {
      computedSnoozedUntil = null;
    } else if (data.snoozeDays) {
      computedSnoozedUntil = new Date(now.getTime() + data.snoozeDays * 24 * 60 * 60 * 1000);
    }

    // 1. Fetch existing prefs or prepare upsert
    const [existing] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, auth.user.id))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(notificationPrefs)
        .set({
          pushEnabled: data.pushEnabled ?? existing.pushEnabled,
          quotationUpdates: data.quotationUpdates ?? existing.quotationUpdates,
          // CRITICAL INVARIANT: Security and payment notifications cannot be turned off
          paymentUpdates: true,
          deliveryUpdates: data.deliveryUpdates ?? existing.deliveryUpdates,
          deadlineAlerts: data.deadlineAlerts ?? existing.deadlineAlerts,
          changeRequestUpdates: data.changeRequestUpdates ?? existing.changeRequestUpdates,
          disputeUpdates: data.disputeUpdates ?? existing.disputeUpdates,
          ...(computedSnoozedUntil !== undefined ? { snoozedUntil: computedSnoozedUntil } : {}),
          updatedAt: now,
        })
        .where(eq(notificationPrefs.userId, auth.user.id))
        .returning();

      return NextResponse.json({
        success: true,
        prefs: updated,
      });
    } else {
      const [inserted] = await db
        .insert(notificationPrefs)
        .values({
          userId: auth.user.id,
          pushEnabled: data.pushEnabled ?? true,
          quotationUpdates: data.quotationUpdates ?? true,
          // CRITICAL INVARIANT: Security and payment notifications cannot be turned off
          paymentUpdates: true,
          deliveryUpdates: data.deliveryUpdates ?? true,
          deadlineAlerts: data.deadlineAlerts ?? true,
          changeRequestUpdates: data.changeRequestUpdates ?? true,
          disputeUpdates: data.disputeUpdates ?? true,
          snoozedUntil: computedSnoozedUntil || null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return NextResponse.json({
        success: true,
        prefs: inserted,
      });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Notifications/Prefs/PATCH] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences." },
      { status: 500 }
    );
  }
}
