import { NextResponse } from "next/server";
import { eq, and, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";

export async function POST() {
  try {
    const auth = await requireAuth();
    const now = new Date();

    await db
      .update(notifications)
      .set({
        read: true,
        readAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(notifications.userId, auth.user.id),
          or(eq(notifications.read, false), isNull(notifications.readAt))
        )
      );

    return NextResponse.json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Notifications/ReadAll] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to mark all notifications as read." },
      { status: 500 }
    );
  }
}
