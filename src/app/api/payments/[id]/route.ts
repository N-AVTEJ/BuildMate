import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, projects, paymentProofs } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import { getDownloadUrl } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id: paymentId } = await params;

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    // 1. Fetch payment
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    // 2. Fetch associated project for scoped ownership check
    const [project] = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        projectCode: projects.projectCode,
        title: projects.title,
        status: projects.status,
      })
      .from(projects)
      .where(eq(projects.id, payment.projectId))
      .limit(1);

    // IDOR Protection: Scoped strictly through project relationship
    if (!project) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }
    authorize(auth, "PAYMENT_VIEW", { clientId: project.clientId });

    // 3. Fetch payment proofs and generate fresh short-lived signed download URLs
    const proofsList = await db
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.paymentId, payment.id));

    const proofsWithSignedUrls = await Promise.all(
      proofsList.map(async (proof) => ({
        id: proof.id,
        fileType: proof.fileType,
        fileSize: proof.fileSize,
        uploadedAt: proof.uploadedAt,
        downloadUrl: await getDownloadUrl(proof.fileUrl, 60),
      }))
    );

    return NextResponse.json({
      payment: {
        id: payment.id,
        projectId: payment.projectId,
        type: payment.type,
        expectedAmount: payment.expectedAmount,
        transactionReference: payment.transactionReference,
        status: payment.status,
        submittedAt: payment.submittedAt,
        verifiedAt: payment.verifiedAt,
        rejectionReason: payment.rejectionReason,
      },
      project: {
        id: project.id,
        projectCode: project.projectCode,
        title: project.title,
        status: project.status,
      },
      proofs: proofsWithSignedUrls,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Payments/Detail] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching payment details." },
      { status: 500 }
    );
  }
}
