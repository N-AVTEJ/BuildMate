import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";

const unsubscribeSchema = z.object({
  endpoint: z.string().url("Invalid push subscription endpoint URL."),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();

    const body = await req.json().catch(() => ({}));
    const parseResult = unsubscribeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid unsubscribe payload." },
        { status: 400 }
      );
    }

    const { endpoint } = parseResult.data;

    // Security invariant: User A cannot revoke User B's subscription (scoped by auth.user.id)
    await db
      .update(pushSubscriptions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.userId, auth.user.id)
        )
      );

    return NextResponse.json({
      success: true,
      message: "Push subscription revoked successfully.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Push/Unsubscribe] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to revoke push subscription." },
      { status: 500 }
    );
  }
}
