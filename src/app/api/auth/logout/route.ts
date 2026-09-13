import { NextResponse } from "next/server";
import {
  getSessionTokenFromCookies,
  invalidateSession,
  clearSessionCookie,
} from "@/lib/auth/session";

export async function POST() {
  try {
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
