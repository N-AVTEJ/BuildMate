import { NextResponse } from "next/server";
import { eq, and, desc, lt, count, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(req.url);

    const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50);
    const cursor = url.searchParams.get("cursor");
    const rawOffset = parseInt(url.searchParams.get("offset") || "0", 10);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    // Backward compatibility: A notification is unread if and only if `read` is false.
    // Legacy rows with `read === true` (where `readAt` was not recorded) remain correctly treated as read.
    const unreadCondition = eq(notifications.read, false);

    const baseFilter = unreadOnly
      ? and(eq(notifications.userId, auth.user.id), unreadCondition)
      : eq(notifications.userId, auth.user.id);

    // Total and unread count queries
    const [[countResult], [unreadResult]] = await Promise.all([
      db
        .select({ value: count() })
        .from(notifications)
        .where(baseFilter),
      db
        .select({ value: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, auth.user.id), unreadCondition)),
    ]);

    const total = countResult?.value || 0;
    const unreadCount = unreadResult?.value || 0;

    let rows: (typeof notifications.$inferSelect)[];
    let nextCursor: string | null = null;
    let hasMore = false;

    if (cursor) {
      // Cursor-based pagination using createdAt timestamp
      const cursorDate = new Date(cursor);
      const cursorFilter = and(baseFilter, lt(notifications.createdAt, cursorDate));

      const fetched = await db
        .select()
        .from(notifications)
        .where(cursorFilter)
        .orderBy(desc(notifications.createdAt))
        .limit(limit + 1);

      if (fetched.length > limit) {
        hasMore = true;
        rows = fetched.slice(0, limit);
        nextCursor = rows[rows.length - 1].createdAt.toISOString();
      } else {
        rows = fetched;
        nextCursor = null;
      }
    } else {
      // Offset-based pagination with lookahead
      const fetched = await db
        .select()
        .from(notifications)
        .where(baseFilter)
        .orderBy(desc(notifications.createdAt))
        .limit(limit + 1)
        .offset(offset);

      if (fetched.length > limit) {
        hasMore = true;
        rows = fetched.slice(0, limit);
        nextCursor = rows[rows.length - 1].createdAt.toISOString();
      } else {
        rows = fetched;
        nextCursor = null;
      }
    }

    return NextResponse.json({
      success: true,
      notifications: rows,
      unreadCount,
      hasMore,
      nextCursor,
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
    const now = new Date();

    if (body.all) {
      await db
        .update(notifications)
        .set({ read: true, readAt: now, updatedAt: now })
        .where(eq(notifications.userId, auth.user.id));

      return NextResponse.json({ success: true, message: "All notifications marked as read." });
    }

    if (body.id) {
      await db
        .update(notifications)
        .set({ read: true, readAt: now, updatedAt: now })
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
