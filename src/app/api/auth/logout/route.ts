import { NextResponse } from "next/server";
import {
  getSessionTokenFromCookies,
  invalidateSession,
  clearSessionCookie,
} from "@/lib/auth/session";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.endpoint && typeof body.endpoint === "string") {
      try {
        await db
          .update(pushSubscriptions)
          .set({ revokedAt: new Date() })
          .where(eq(pushSubscriptions.endpoint, body.endpoint));
      } catch (subErr) {
        console.warn("[Auth/Logout] Failed to revoke push subscription on logout:", subErr);
      }
    }

    const rawToken = await getSessionTokenFromCookies();
    if (rawToken) {
      await invalidateSession(rawToken);
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
