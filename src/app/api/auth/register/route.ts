import { NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles, emailVerificationTokens } from "@/db/schema";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import {
  validatePasswordComplexity,
  hashPassword,
  dummyHashPassword,
} from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/email/resend";

const GENERIC_REGISTER_RESPONSE = {
  message: "If this email is eligible, a verification link has been sent.",
};

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting: 3 requests per hour per IP
    const clientIp = getClientIp(req);
    const rl = await rateLimit(`register:${clientIp}`, 3, "1 h");
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Parse & Validate Payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { name, email, password, confirmPassword } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 255) {
      return NextResponse.json(
        { error: "Invalid email address format." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    const passwordCheck = validatePasswordComplexity(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.message },
        { status: 400 }
      );
    }

    // 3. Account Enumeration Defense
    // Check if user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      // Execute dummy Argon2id hash to equalize response duration
      await dummyHashPassword(password);
      return NextResponse.json(GENERIC_REGISTER_RESPONSE, { status: 200 });
    }

    // 4. Hash Password with Argon2id
    const passwordHash = await hashPassword(password);

    // 5. Database Transaction: Create User + Role (CLIENT) + Verification Token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          emailVerified: false,
        })
        .returning({ id: users.id });

      // Role is hardcoded to CLIENT. Client input can never choose or inject roles.
      await tx.insert(userRoles).values({
        userId: newUser.id,
        role: "CLIENT",
      });

      await tx.insert(emailVerificationTokens).values({
        userId: newUser.id,
        tokenHash,
        expiresAt,
        used: false,
      });
    });

    // 6. Deliver Verification Email
    // If delivery fails, we do NOT rollback the created user.
    // The user can recover via /api/auth/resend-verification.
    await sendVerificationEmail(normalizedEmail, rawToken);

    // Never return password, hash, or token in response
    return NextResponse.json(GENERIC_REGISTER_RESPONSE, { status: 201 });
  } catch (error) {
    console.error("[Auth/Register] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}
