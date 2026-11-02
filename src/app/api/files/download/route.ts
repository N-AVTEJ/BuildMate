import { NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import os from "os";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const sig = url.searchParams.get("sig");
    const expires = url.searchParams.get("expires");

    if (!key || !sig || !expires) {
      return NextResponse.json({ error: "Missing required download parameters." }, { status: 400 });
    }

    const expiresTime = parseInt(expires, 10);
    if (isNaN(expiresTime) || Date.now() > expiresTime) {
      return NextResponse.json({ error: "Download link has expired." }, { status: 403 });
    }

    // Verify HMAC
    const expectedSig = crypto
      .createHmac("sha256", process.env.SESSION_SECRET || "dev-storage-secret")
      .update(`${key}:${expires}`)
      .digest("hex");

    if (sig !== expectedSig) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
    }

    // Locate file safely (basename only to prevent path traversal)
    const safeFilename = path.basename(key);
    const primaryPath = path.join(process.cwd(), "storage", "uploads", safeFilename);
    const fallbackPath = path.join(os.tmpdir(), "buildmate-uploads", safeFilename);

    let fileBuffer: Buffer | null = null;
    try {
      fileBuffer = await fs.readFile(primaryPath);
    } catch {
      try {
        fileBuffer = await fs.readFile(fallbackPath);
      } catch {
        return NextResponse.json({ error: "File not found." }, { status: 404 });
      }
    }

    // Determine MIME type
    const ext = path.extname(safeFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Files/Download] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
