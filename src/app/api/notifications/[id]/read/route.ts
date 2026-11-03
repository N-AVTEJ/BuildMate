import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id: notificationId } = await params;

    if (!notificationId) {
      return NextResponse.json({ error: "Missing notification id." }, { status: 400 });
    }

    const now = new Date();

    // Security invariant: User A cannot mark User B's notification as read
    const [updated] = await db
      .update(notifications)
      .set({
        read: true,
        readAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, auth.user.id)
        )
      )
      .returning({ id: notifications.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Notification not found or unauthorized." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Notifications/Read] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read." },
      { status: 500 }
    );
  }
}
