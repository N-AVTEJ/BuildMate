import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { validateUploadFile } from "@/lib/storage/validation";
import { storageProvider } from "@/lib/storage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let savedStorageKey: string | null = null;

  try {
    // 1. Authenticate Session
    const auth = await requireAuth();

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // 2. Fetch Project & Enforce Ownership via Central Authorization (IDOR Defense)
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    authorize(auth, "PROJECT_UPLOAD_REQUIREMENT", { clientId: project.clientId });

    // 3. Strict Upload Status & Expiry Check
    const now = new Date();
    const effective = computeEffectiveStatus(project, now);

    if (effective.status !== "AVAILABLE") {
      // If stored status was AVAILABLE but deadline has passed, transactionally reconcile
      if (effective.changed) {
        await reconcileProjectStatusInDb(project.id, now);
      }
      return NextResponse.json(
        { error: "Cannot upload requirements: This project is no longer available for builder discovery." },
        { status: 400 }
      );
    }

    // 4. Parse Multipart Form Data
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "A valid file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 5. Deep File Validation (Magic bytes, allowlist, 5MB limit, dangerous extension rejection)
    const validation = validateUploadFile(buffer, file.name, file.type);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 6. Save File to Storage Provider
    const uploadResult = await storageProvider.upload(
      buffer,
      validation.sanitizedFilename || file.name,
      validation.detectedMime || file.type
    );
    savedStorageKey = uploadResult.storageKey;

    // 7. Insert Requirement Record into Database
    // If DB insert fails, cleanup file in catch block
    const [requirement] = await db
      .insert(projectRequirements)
      .values({
        projectId: project.id,
        fileUrl: uploadResult.fileUrl,
        fileType: validation.detectedMime || file.type,
        fileSize: buffer.length,
      })
      .returning();

    return NextResponse.json({ requirement }, { status: 201 });
  } catch (error) {
    // Rollback Cleanup: if file was written to storage but subsequent operations failed
    if (savedStorageKey) {
      try {
        await storageProvider.delete(savedStorageKey);
      } catch (cleanupError) {
        console.error("[Requirements/Upload] Error deleting orphaned file:", cleanupError);
      }
    }

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Requirements/Upload] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while uploading requirements." },
      { status: 500 }
    );
  }
}
