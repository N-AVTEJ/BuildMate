import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, emailVerificationTokens } from "@/db/schema";
import { hashToken } from "@/lib/auth/session";

const GENERIC_VERIFY_ERROR = "Invalid or expired verification token.";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json(
        { error: GENERIC_VERIFY_ERROR },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token.trim());
    const now = new Date();

    // 1. Look up the token
    const [tokenRecord] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          eq(emailVerificationTokens.used, false)
        )
      )
      .limit(1);

    // 2. Validate token presence, single-use, and expiration
    if (!tokenRecord || tokenRecord.expiresAt < now) {
      return NextResponse.json(
        { error: GENERIC_VERIFY_ERROR },
        { status: 400 }
      );
    }

    // 3. Perform transactional state change:
    // Mark token used and user emailVerified in a single atomic transaction
    await db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ used: true })
        .where(eq(emailVerificationTokens.id, tokenRecord.id));

      await tx
        .update(users)
        .set({
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, tokenRecord.userId));
    });

    return NextResponse.json({
      success: true,
      message: "Email successfully verified. You may now log in to your account.",
    });
  } catch (error) {
    console.error("[Auth/VerifyEmail] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during email verification." },
      { status: 500 }
    );
  }
}
