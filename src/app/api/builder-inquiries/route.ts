import { NextResponse } from "next/server";
import { db } from "@/db";
import { builderInquiries } from "@/db/schema";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { name, email, message } = body;

    // 1. Rate Limiting: 3 requests per hour per IP (public unauthenticated write)
    const clientIp = getClientIp(req);
    const rl = await rateLimit(`builder_inquiry:${clientIp}`, 3, "1 h");
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many inquiries submitted from this IP. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Input Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 255) {
      return NextResponse.json(
        { error: "Name must not exceed 255 characters." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail.length > 255 || !EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    let trimmedMessage: string | null = null;
    if (message !== undefined && message !== null) {
      if (typeof message !== "string") {
        return NextResponse.json(
          { error: "Message must be a string." },
          { status: 400 }
        );
      }
      trimmedMessage = message.trim();
      if (trimmedMessage.length > 1000) {
        return NextResponse.json(
          { error: "Message must not exceed 1000 characters." },
          { status: 400 }
        );
      }
      if (trimmedMessage.length === 0) {
        trimmedMessage = null;
      }
    }

    // 3. Database Insertion (lead record only - no account, no session, no role created)
    const [inquiry] = await db
      .insert(builderInquiries)
      .values({
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
      })
      .returning({
        id: builderInquiries.id,
        createdAt: builderInquiries.createdAt,
      });

    return NextResponse.json(
      {
        success: true,
        message: "Thanks — we'll be in touch.",
        id: inquiry.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[BuilderInquiries] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your inquiry." },
      { status: 500 }
    );
  }
}
