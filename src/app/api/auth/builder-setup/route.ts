import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles, emailVerificationTokens } from "@/db/schema";
import { hashToken } from "@/lib/auth/session";
import { validatePasswordComplexity, hashPassword } from "@/lib/auth/password";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { valid: false, error: "Missing or invalid setup token." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token.trim());
    const now = new Date();

    const [tokenRecord] = await db
      .select({
        id: emailVerificationTokens.id,
        userId: emailVerificationTokens.userId,
        expiresAt: emailVerificationTokens.expiresAt,
        used: emailVerificationTokens.used,
      })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          eq(emailVerificationTokens.used, false)
        )
      )
      .limit(1);

    if (!tokenRecord || tokenRecord.expiresAt < now) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired setup token. Please request a new setup link." },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    return NextResponse.json({
      valid: true,
      email: user?.email,
      name: user?.name,
    });
  } catch (error) {
    console.error("[Auth/BuilderSetup/Validate] Unexpected error:", error);
    return NextResponse.json(
      { valid: false, error: "An unexpected error occurred while validating setup token." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { token, password } = body;

    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "Setup token is required." },
        { status: 400 }
      );
    }

    // 1. Password Complexity Validation (Argon2id compliant)
    const passwordValidation = validatePasswordComplexity(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message || "Password does not meet complexity requirements." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token.trim());
    const now = new Date();

    // 2. Validate token existence, single-use, and expiration
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

    if (!tokenRecord || tokenRecord.expiresAt < now) {
      return NextResponse.json(
        { error: "Invalid or expired setup token. Please request a new setup link from the administrator." },
        { status: 400 }
      );
    }

    // 3. Hash password using Argon2id
    const newPasswordHash = await hashPassword(password);

    // 4. Atomic transaction: mark token used, set passwordHash, ensure emailVerified & BUILDER role
    await db.transaction(async (tx) => {
      // Invalidate token
      await tx
        .update(emailVerificationTokens)
        .set({ used: true })
        .where(eq(emailVerificationTokens.id, tokenRecord.id));

      // Update user credentials
      await tx
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, tokenRecord.userId));

      // Ensure BUILDER role is attached
      await tx
        .insert(userRoles)
        .values({
          userId: tokenRecord.userId,
          role: "BUILDER",
        })
        .onConflictDoNothing();
    });

    return NextResponse.json({
      success: true,
      message: "Builder credentials successfully configured. You may now log in.",
      redirectTo: "/builder/login",
    });
  } catch (error) {
    console.error("[Auth/BuilderSetup] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during password setup." },
      { status: 500 }
    );
  }
}
