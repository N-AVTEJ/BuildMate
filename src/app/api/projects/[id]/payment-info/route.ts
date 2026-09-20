import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects, payments } from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id: projectId } = await params;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // 1. Fetch project
    const [project] = await db
      .select({
        id: projects.id,
        projectCode: projects.projectCode,
        clientId: projects.clientId,
        title: projects.title,
        status: projects.status,
        advanceAmount: projects.advanceAmount,
        remainingAmount: projects.remainingAmount,
        advancePaymentDeadline: projects.advancePaymentDeadline,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    // 2. IDOR & Authorization Defense
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    authorize(auth, "PAYMENT_VIEW_INFO", { clientId: project.clientId });

    // 3. Derive payment type from project status
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

    // 4. Server-derived expected amount with STRICT POSITIVE INTEGER GUARD
    const rawExpectedAmount =
      paymentType === "ADVANCE" ? project.advanceAmount : project.remainingAmount;

    if (
      rawExpectedAmount === null ||
      rawExpectedAmount === undefined ||
      typeof rawExpectedAmount !== "number" ||
      rawExpectedAmount <= 0 ||
      !Number.isInteger(rawExpectedAmount)
    ) {
      return NextResponse.json(
        {
          error:
            "Project payment amount is not configured or invalid. Cannot generate payment instructions.",
        },
        { status: 409 }
      );
    }

    const expectedAmount = rawExpectedAmount;

    // 5. Fetch existing payment record for (projectId, paymentType) if any
    const [existingPayment] = await db
      .select({
        id: payments.id,
        status: payments.status,
        submittedAt: payments.submittedAt,
        transactionReference: payments.transactionReference,
        rejectionReason: payments.rejectionReason,
      })
      .from(payments)
      .where(
        and(
          eq(payments.projectId, project.id),
          eq(payments.type, paymentType)
        )
      )
      .limit(1);

    return NextResponse.json({
      projectId: project.id,
      projectCode: project.projectCode,
      title: project.title,
      paymentType,
      expectedAmount,
      advancePaymentDeadline: project.advancePaymentDeadline,
      qrImageUrl: "/images/payment-qr.svg",
      upiId: "buildmate@bank",
      projectStatus: project.status,
      existingPayment: existingPayment || null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Projects/PaymentInfo] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching payment info." },
      { status: 500 }
    );
  }
}
