import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    if (!key) {
      return NextResponse.json({ error: "File key required." }, { status: 400 });
    }

    const safeKey = path.basename(key);
    const localDir = path.join(process.cwd(), "storage", "uploads");
    const tmpDir = path.join(os.tmpdir(), "buildmate-uploads");

    let fileBuffer: Buffer | null = null;

    try {
      fileBuffer = await fs.readFile(path.join(localDir, safeKey));
    } catch {
      try {
        fileBuffer = await fs.readFile(path.join(tmpDir, safeKey));
      } catch {
        // Not found
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

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeKey}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[Files/Key] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
