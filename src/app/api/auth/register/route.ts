import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import {
  validatePasswordComplexity,
  hashPassword,
} from "@/lib/auth/password";

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting: 20 requests per hour per IP (higher limit for tests/dev)
    const clientIp = getClientIp(req);
    const limit = process.env.NODE_ENV === "production" ? 20 : 100;
    const rl = await rateLimit(`register:${clientIp}`, limit, "1 h");
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

    const name = body.fullName || body.name;
    const { email, phone, password, confirmPassword } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Full name is required." },
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

    // Phone validation
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      );
    }

    const cleanPhone = phone.trim();
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,16}$/;
    if (!phoneRegex.test(cleanPhone) || cleanPhone.replace(/\D/g, "").length < 7) {
      return NextResponse.json(
        { error: "Please enter a valid phone number (minimum 7 digits)." },
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

    // 3. Check existing user
    const [existingUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      // Check if user already has CLIENT role
      const existingClientRole = await db
        .select({ id: userRoles.id })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.userId, existingUser.id),
            eq(userRoles.role, "CLIENT")
          )
        )
        .limit(1);

      if (existingClientRole.length > 0) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 400 }
        );
      }

      // Existing user (e.g. BUILDER or ADMIN) registering as CLIENT -> grant CLIENT role
      await db.insert(userRoles).values({
        userId: existingUser.id,
        role: "CLIENT",
      });

      // Update phone if previously empty
      await db
        .update(users)
        .set({ phone: cleanPhone, updatedAt: new Date() })
        .where(eq(users.id, existingUser.id));

      return NextResponse.json(
        {
          success: true,
          message: "Client access added to your existing account. You can now sign in.",
        },
        { status: 201 }
      );
    }

    // 4. Hash Password with Argon2id
    const passwordHash = await hashPassword(password);

    // 5. Database Transaction: Create User + Role (CLIENT strictly)
    // V1 Policy: emailVerified is true immediately upon registration
    let createdUserId: string = "";
    await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          name: name.trim(),
          email: normalizedEmail,
          phone: cleanPhone,
          passwordHash,
          emailVerified: true, // V1 policy
        })
        .returning({ id: users.id });

      createdUserId = newUser.id;

      // Public registration is strictly CLIENT ONLY. Frontend role parameters are ignored.
      await tx.insert(userRoles).values({
        userId: newUser.id,
        role: "CLIENT",
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Client account created successfully. You can now sign in.",
        user: {
          id: createdUserId,
          name: name.trim(),
          email: normalizedEmail,
          phone: cleanPhone,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Auth/Register] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}
