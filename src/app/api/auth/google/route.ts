import { NextResponse } from "next/server";
import { generateOAuthState, getGoogleAuthUrl } from "@/lib/auth/google";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const returnTo = searchParams.get("returnTo") || "/dashboard";

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn("[Auth/Google] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in environment variables.");
      return NextResponse.redirect(new URL("/login?error=google_not_configured", req.url));
    }

    const state = generateOAuthState();
    const authUrl = getGoogleAuthUrl(state, req);
    const redirectUri = new URL(authUrl).searchParams.get("redirect_uri") || "";

    const response = NextResponse.redirect(authUrl);

    // Store state, returnTo, and redirectUri in an HttpOnly cookie (valid 10 minutes)
    response.cookies.set("google_oauth_state", JSON.stringify({ state, returnTo, redirectUri }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });

    return response;
  } catch (error: any) {
    console.error("[Auth/Google] Error initiating Google login:", error);
    return NextResponse.redirect(new URL("/login?error=google_init_failed", req.url));
  }
}
