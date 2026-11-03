import { NextResponse } from "next/server";
import {
  getSessionTokenFromCookies,
  validateSession,
  invalidateSession,
  clearSessionCookie,
} from "@/lib/auth/session";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const rawToken = await getSessionTokenFromCookies();
    let currentUserId: string | null = null;

    if (rawToken) {
      const session = await validateSession(rawToken);
      if (session) {
        currentUserId = session.user.id;
      }
      await invalidateSession(rawToken);
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
