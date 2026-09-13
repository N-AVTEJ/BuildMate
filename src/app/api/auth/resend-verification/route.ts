import { NextResponse } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, emailVerificationTokens } from "@/db/schema";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import { dummyHashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/email/resend";

const GENERIC_RESEND_RESPONSE = {
  message: "If this email is eligible, a verification link has been sent.",
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(GENERIC_RESEND_RESPONSE, { status: 200 });
    }

    const { email } = body;
    if (!email || typeof email !== "string") {
      return NextResponse.json(GENERIC_RESEND_RESPONSE, { status: 200 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIp = getClientIp(req);

    // 1. Rate Limiting: 3 requests per hour per IP + normalized email
    const rl = await rateLimit(`resend:${clientIp}:${normalizedEmail}`, 3, "1 h");
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many resend attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Lookup User
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // 3. Timing Equalization on Nonexistent or Already-Verified Accounts
    if (!user || user.emailVerified) {
      await dummyHashPassword("dummy-timing-equalization");
      return NextResponse.json(GENERIC_RESEND_RESPONSE, { status: 200 });
    }

    // 4. Generate Fresh Verification Token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Invalidate existing unused tokens for this user and insert fresh token
    await db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ used: true })
        .where(
          and(
            eq(emailVerificationTokens.userId, user.id),
            eq(emailVerificationTokens.used, false)
          )
        );

      await tx.insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
        used: false,
      });
    });

    // 5. Deliver Verification Email
    await sendVerificationEmail(normalizedEmail, rawToken);

    return NextResponse.json(GENERIC_RESEND_RESPONSE, { status: 200 });
  } catch (error) {
    console.error("[Auth/ResendVerification] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
