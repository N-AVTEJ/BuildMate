import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles, roleEnum } from "@/db/schema";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import { verifyPassword, dummyVerifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie, UserRole } from "@/lib/auth/session";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    const { email, password } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIp = getClientIp(req);

    // 1. Rate Limiting: 5 attempts per 15 minutes per IP + normalized email
    const rl = await rateLimit(`login:${clientIp}:${normalizedEmail}`, 5, "15 m");
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Lookup User
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // 3. Timing-Equalized Password Verification
    if (!user) {
      // Execute dummy Argon2id verification to equalize timing
      await dummyVerifyPassword(password);
      return NextResponse.json(
        { error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(user.passwordHash, password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    // 4. Session Creation & Cookie Issuance
    const { rawToken, expiresAt } = await createSession(user.id);
    await setSessionCookie(rawToken, expiresAt);

    // 5. Retrieve Roles
    const roleRows = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));

    const roles: UserRole[] = roleRows.map((r) => r.role as UserRole);

    // Return sanitized profile (never return password or session token)
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        roles,
      },
    });
  } catch (error) {
    console.error("[Auth/Login] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
