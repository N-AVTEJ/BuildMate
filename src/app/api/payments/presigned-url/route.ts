import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import {
  isValidProofExtension,
  isValidProofMimeType,
  generatePaymentProofKey,
  getUploadUrl,
  StorageConfigurationError,
} from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    authorize(auth, "PAYMENT_SUBMIT_PROOF");

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { projectId, extension, mimeType } = body || {};

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    if (!extension || typeof extension !== "string" || !isValidProofExtension(extension)) {
      return NextResponse.json(
        { error: "Invalid or unsupported file extension. Allowed: .jpg, .jpeg, .png, .webp." },
        { status: 400 }
      );
    }

    const normalizedMime = mimeType && typeof mimeType === "string" ? mimeType.toLowerCase() : "image/png";
    if (!isValidProofMimeType(normalizedMime)) {
      return NextResponse.json(
        { error: "Invalid or unsupported MIME type. Allowed: image/jpeg, image/png, image/webp." },
        { status: 400 }
      );
    }

    // 1. Fetch project and verify ownership
    const [project] = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        status: projects.status,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    authorize(auth, "PAYMENT_SUBMIT_PROOF", { clientId: project.clientId });

    // 2. Derive payment type from project status
    let paymentType: "ADVANCE" | "FINAL";
    if (
      project.status === "AWAITING_ADVANCE" ||
      project.status === "ADVANCE_PROOF_SUBMITTED" ||
      project.status === "PAYMENT_REJECTED"
    ) {
      paymentType = "ADVANCE";
    } else if (
      project.status === "FINAL_PAYMENT_PENDING" ||
      project.status === "FINAL_PAYMENT_PROOF_SUBMITTED"
    ) {
      paymentType = "FINAL";
    } else {
      return NextResponse.json(
        { error: `Project is not currently awaiting payment (current status: ${project.status}).` },
        { status: 400 }
      );
    }

    // 3. Generate server-controlled scoped key
    const storageKey = generatePaymentProofKey(project.id, paymentType, extension);

    // 4. Generate presigned PUT URL (TTL ~5 min)
    const uploadUrl = await getUploadUrl(storageKey, normalizedMime, 300);

    return NextResponse.json({
      uploadUrl,
      storageKey,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Payments/PresignedUrl] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while generating upload URL." },
      { status: 500 }
    );
  }
}
