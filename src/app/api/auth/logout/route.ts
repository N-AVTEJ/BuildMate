import { NextResponse } from "next/server";
import {
  getSessionTokenFromCookies,
  clearSessionCookie,
  hashToken,
} from "@/lib/auth/session";

import { db } from "@/db";
import { sessions, pushSubscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const rawToken = await getSessionTokenFromCookies();
    let currentUserId: string | null = null;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      // Atomic session invalidation: delete session and retrieve userId in a single DB query
      const deleted = await db
        .delete(sessions)
        .where(eq(sessions.tokenHash, tokenHash))
        .returning({ userId: sessions.userId });

      currentUserId = deleted[0]?.userId ?? null;
    }

    const body = await req.json().catch(() => ({}));
    if (currentUserId && body?.endpoint && typeof body.endpoint === "string") {
      try {
        await db
          .update(pushSubscriptions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(pushSubscriptions.endpoint, body.endpoint),
              eq(pushSubscriptions.userId, currentUserId)
            )
          );
      } catch (subErr) {
        console.warn("[Auth/Logout] Failed to revoke push subscription on logout:", subErr);
      }
    }
    await clearSessionCookie();

    return NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("[Auth/Logout] Unexpected error:", error);
    // Ensure cookie is still cleared on error
    await clearSessionCookie();
    return NextResponse.json(
      { error: "An unexpected error occurred during logout." },
      { status: 500 }
    );
  }
}
