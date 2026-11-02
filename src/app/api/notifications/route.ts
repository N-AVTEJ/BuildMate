import { NextResponse } from "next/server";
import { eq, and, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(req.url);

    const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50);
    const rawOffset = parseInt(url.searchParams.get("offset") || "0", 10);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const whereClause = unreadOnly
      ? and(eq(notifications.userId, auth.user.id), eq(notifications.read, false))
      : eq(notifications.userId, auth.user.id);

    // Get total count
    const [countResult] = await db
      .select({ value: count() })
      .from(notifications)
      .where(whereClause);

    const total = countResult?.value || 0;

    // Fetch paginated notifications
    const rows = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      notifications: rows,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Notifications/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching notifications." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    const body = await req.json().catch(() => ({}));

    if (body.all) {
      await db
        .update(notifications)
        .set({ read: true, updatedAt: new Date() })
        .where(eq(notifications.userId, auth.user.id));

      return NextResponse.json({ success: true, message: "All notifications marked as read." });
    }

    if (body.id) {
      await db
        .update(notifications)
        .set({ read: true, updatedAt: new Date() })
        .where(
          and(
            eq(notifications.id, body.id),
            eq(notifications.userId, auth.user.id)
          )
        );

      return NextResponse.json({ success: true, message: "Notification marked as read." });
    }

    return NextResponse.json({ error: "Missing id or all parameter." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Notifications/PATCH] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while updating notifications." },
      { status: 500 }
    );
  }
}
