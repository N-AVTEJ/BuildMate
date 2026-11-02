import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import os from "os";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const sig = url.searchParams.get("sig");
    const expires = url.searchParams.get("expires");

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter." }, { status: 400 });
    }

    // Verify HMAC signature if provided
    if (sig && expires) {
      const expiresNum = parseInt(expires, 10);
      if (Date.now() > expiresNum) {
        return NextResponse.json({ error: "Download link has expired." }, { status: 410 });
      }

      // Check HMAC for both payment proofs and resumes
      const expectedSigWithTime = crypto
        .createHmac("sha256", process.env.SESSION_SECRET || "dev-storage-secret")
        .update(`${key}:${expiresNum}`)
        .digest("hex");

      const expectedSigWithoutTime = crypto
        .createHmac("sha256", process.env.SESSION_SECRET || "dev-storage-secret")
        .update(key)
        .digest("hex");

      if (sig !== expectedSigWithTime && sig !== expectedSigWithoutTime) {
        return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
      }
    }

    const safeKey = path.basename(key);
    const localDir = path.join(process.cwd(), "storage", "uploads");
    const tmpDir = path.join(os.tmpdir(), "buildmate-uploads");

    let fileBuffer: Buffer | null = null;
    let foundPath = "";

    try {
      foundPath = path.join(localDir, safeKey);
      fileBuffer = await fs.readFile(foundPath);
    } catch {
      try {
        foundPath = path.join(tmpDir, safeKey);
        fileBuffer = await fs.readFile(foundPath);
      } catch {
        // Not found locally
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const ext = path.extname(safeKey).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".pdf") contentType = "application/pdf";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".docx") {
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeKey}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[Files/Download] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
