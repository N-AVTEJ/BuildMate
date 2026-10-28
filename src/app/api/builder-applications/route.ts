import { NextResponse } from "next/server";
import { db } from "@/db";
import { builderApplications } from "@/db/schema";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import { validateResumeFile } from "@/lib/storage/resume-validation";
import { storageProvider } from "@/lib/storage";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting: Strictly 3 requests per hour per IP (public unauthenticated write)
    const clientIp = getClientIp(req);
    const rl = await rateLimit(`builder_application:${clientIp}`, 3, "1 h");
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many applications submitted from this IP. Please try again later." },
        { status: 429 }
      );
    }

    let name = "";
    let email = "";
    let githubUrl: string | null = null;
    let message: string | null = null;
    let resumeUrl = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData().catch(() => null);
      if (!formData) {
        return NextResponse.json({ error: "Invalid form data submission." }, { status: 400 });
      }

      name = String(formData.get("name") || "").trim();
      email = String(formData.get("email") || "").trim();
      const rawGithub = String(formData.get("githubUrl") || formData.get("githubLink") || "").trim();
      const rawMessage = String(formData.get("message") || "").trim();
      githubUrl = rawGithub.length > 0 ? rawGithub : null;
      message = rawMessage.length > 0 ? rawMessage : null;

      const resumeFile = formData.get("resume") as File | null;
      if (!resumeFile || typeof resumeFile === "string" || resumeFile.size === 0) {
        return NextResponse.json(
          { error: "A resume file (.pdf or .docx, max 5 MB) is required." },
          { status: 400 }
        );
      }

      // Convert resume File to Node.js Buffer
      const arrayBuffer = await resumeFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Validate resume buffer against Phase 3 security allowlist (size, extension, magic bytes)
      const validation = validateResumeFile(buffer, resumeFile.name);
      if (!validation.valid || !validation.sanitizedFilename || !validation.detectedMime) {
        return NextResponse.json(
          { error: validation.error || "Invalid resume file." },
          { status: 400 }
        );
      }

      // Upload file via server storage provider
      const uploadResult = await storageProvider.upload(
        buffer,
        validation.sanitizedFilename,
        validation.detectedMime
      );

      resumeUrl = uploadResult.storageKey || uploadResult.fileUrl;
    } else {
      // JSON payload support
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
      }

      name = String(body.name || "").trim();
      email = String(body.email || "").trim();
      githubUrl = body.githubUrl ? String(body.githubUrl).trim() : null;
      message = body.message ? String(body.message).trim() : null;
      resumeUrl = String(body.resumeUrl || body.resume || "").trim();

      if (!resumeUrl) {
        return NextResponse.json(
          { error: "Resume file or resumeUrl is required." },
          { status: 400 }
        );
      }

      const extMatch = resumeUrl.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "";
      if (ext !== "pdf" && ext !== "docx") {
        return NextResponse.json(
          { error: "Only PDF (.pdf) and Word documents (.docx) are permitted for resumes." },
          { status: 400 }
        );
      }

      if (resumeUrl.includes("..") || resumeUrl.includes("\0")) {
        return NextResponse.json(
          { error: "Invalid resumeUrl path." },
          { status: 400 }
        );
      }
    }

    // 2. Input Validation
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (name.length > 255) {
      return NextResponse.json({ error: "Name must not exceed 255 characters." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase();
    if (normalizedEmail.length > 255 || !EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    if (githubUrl) {
      if (githubUrl.length > 500) {
        return NextResponse.json({ error: "GitHub link must not exceed 500 characters." }, { status: 400 });
      }
      if (!githubUrl.startsWith("http://") && !githubUrl.startsWith("https://")) {
        return NextResponse.json(
          { error: "GitHub profile must be a valid URL starting with http:// or https://" },
          { status: 400 }
        );
      }
    }

    if (message && message.length > 1000) {
      return NextResponse.json({ error: "Message must not exceed 1000 characters." }, { status: 400 });
    }

    // 3. Database Insertion
    // Security Guarantee (Phase 14 Lockdown):
    // This endpoint creates NO user account and NO role.
    // It is strictly a lead/application record with status = PENDING.
    const [application] = await db
      .insert(builderApplications)
      .values({
        name,
        email: normalizedEmail,
        resumeUrl,
        githubUrl,
        message,
        status: "PENDING",
      })
      .returning({
        id: builderApplications.id,
        createdAt: builderApplications.createdAt,
      });

    return NextResponse.json(
      {
        success: true,
        message: "Application submitted successfully. We will review your application personally.",
        id: application.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[BuilderApplications] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your application." },
      { status: 500 }
    );
  }
}
