import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { notify } from "@/lib/notify";

export async function POST() {
  try {
    const auth = await requireAuth();

    await notify(auth.user.id, "TEST_NOTIFICATION", {
      title: "Test Notification",
      body: "Push notifications are active and working smoothly on your device!",
      url: auth.roles.includes("BUILDER") ? "/builder" : "/dashboard",
    });

    return NextResponse.json({
      success: true,
      message: "Test notification dispatched.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Push/Test] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to dispatch test notification." },
      { status: 500 }
    );
  }
}
