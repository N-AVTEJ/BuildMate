import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  payments,
  paymentProofs,
  projectStatusHistory,
  notifications,
  userRoles,
} from "@/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/guards";
import { authorize } from "@/lib/authorization";
import {
  isKeyInProjectScope,
  isValidProofExtension,
  verifyStorageObjectExists,
  MAX_PROOF_SIZE_BYTES,
} from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { projectId, transactionReference, storageKey, fileType, fileSize } =
      body || {};

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    if (
      !transactionReference ||
      typeof transactionReference !== "string" ||
      transactionReference.trim().length < 3
    ) {
      return NextResponse.json(
        { error: "A valid transaction reference (minimum 3 characters) is required." },
        { status: 400 }
      );
    }

    if (!storageKey || typeof storageKey !== "string") {
      return NextResponse.json({ error: "storageKey is required." }, { status: 400 });
    }

    if (fileSize && typeof fileSize === "number" && fileSize > MAX_PROOF_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Uploaded file exceeds maximum permitted size of 5 MB." },
        { status: 400 }
      );
    }

    // 1. Fetch project for independent authorization & status checks
    const [initialProject] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!initialProject) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Central authorization check: CLIENT role, emailVerified, project ownership
    authorize(auth, "PAYMENT_SUBMIT_PROOF", { clientId: initialProject.clientId });

    // 2. Server-derived payment type
    let paymentType: "ADVANCE" | "FINAL";
    if (
      initialProject.status === "AWAITING_ADVANCE" ||
      initialProject.status === "PAYMENT_REJECTED"
    ) {
      paymentType = "ADVANCE";
    } else if (initialProject.status === "FINAL_PAYMENT_PENDING") {
      paymentType = "FINAL";
    } else {
      return NextResponse.json(
        {
          error: `Project is not currently accepting payment proofs (current status: ${initialProject.status}).`,
        },
        { status: 400 }
      );
    }

    // 3. Storage Key Scope Re-authorization (Presigned URL != Proof submission)
    if (!isKeyInProjectScope(storageKey, initialProject.id, paymentType)) {
      return NextResponse.json(
        {
          error:
            "Invalid storage key. Key does not match the authorized project and payment scope.",
        },
        { status: 400 }
      );
    }

    // 4. Verify object existence in R2/storage before database mutation
    const storageCheck = await verifyStorageObjectExists(storageKey);
    if (!storageCheck.exists) {
      return NextResponse.json(
        {
          error:
            "Storage object does not exist. Please upload the screenshot file before submitting proof.",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // 5. Atomic Transaction: Payment + Proof + Project Transition/History + Admin Notification
    const txResult = await db.transaction(async (tx) => {
      // Lock project row
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update")
        .limit(1);

      if (!project) {
        return { type: "NOT_FOUND" as const };
      }

      // Re-verify expected amount is a positive integer
      const expectedAmount =
        paymentType === "ADVANCE" ? project.advanceAmount : project.remainingAmount;

      if (
        expectedAmount === null ||
        expectedAmount === undefined ||
        typeof expectedAmount !== "number" ||
        expectedAmount <= 0
      ) {
        return {
          type: "INVALID_AMOUNT" as const,
          message: "Project payment amount is not configured or invalid.",
        };
      }

      // Late payment check (ADVANCE payments)
      const isLate =
        paymentType === "ADVANCE" &&
        !!project.advancePaymentDeadline &&
        now > project.advancePaymentDeadline;

      const targetPaymentStatus = isLate ? "LATE_PAYMENT_PROOF" : "PROOF_SUBMITTED";

      // Status Progression:
      // Normal ADVANCE proof moves project to ADVANCE_PROOF_SUBMITTED.
      // Late ADVANCE proof strictly remains AWAITING_ADVANCE (no auto-progression).
      if (!isLate && paymentType === "ADVANCE") {
        const previousStatus = project.status;
        await tx
          .update(projects)
          .set({
            status: "ADVANCE_PROOF_SUBMITTED",
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: previousStatus,
          toStatus: "ADVANCE_PROOF_SUBMITTED",
          changedBy: auth.user.id,
        });
      } else if (paymentType === "FINAL") {
        const previousStatus = project.status;
        await tx
          .update(projects)
          .set({
            status: "FINAL_PAYMENT_PROOF_SUBMITTED",
            updatedAt: now,
          })
          .where(eq(projects.id, project.id));

        await tx.insert(projectStatusHistory).values({
          projectId: project.id,
          fromStatus: previousStatus,
          toStatus: "FINAL_PAYMENT_PROOF_SUBMITTED",
          changedBy: auth.user.id,
        });
      }

      // Lock existing payment for (projectId, paymentType) if present
      const [existingPayment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.projectId, project.id),
            eq(payments.type, paymentType)
          )
        )
        .for("update")
        .limit(1);

      let paymentRow: typeof payments.$inferSelect;

      if (existingPayment) {
        if (existingPayment.status === "VERIFIED") {
          return {
            type: "CONFLICT" as const,
            message: "Payment for this project stage has already been verified.",
          };
        }
        if (
          existingPayment.status === "PROOF_SUBMITTED" ||
          existingPayment.status === "LATE_PAYMENT_PROOF"
        ) {
          return {
            type: "CONFLICT" as const,
            message: "A payment proof is already submitted and pending review.",
          };
        }
        if (existingPayment.status === "REJECTED") {
          // Resubmission rule: reuse & reset existing payment record
          const [updated] = await tx
            .update(payments)
            .set({
              status: targetPaymentStatus,
              transactionReference: transactionReference.trim(),
              submittedAt: now,
              rejectionReason: null,
              verifiedAt: null,
              verifiedBy: null,
              updatedAt: now,
            })
            .where(eq(payments.id, existingPayment.id))
            .returning();
          paymentRow = updated;
        } else {
          // Status like AWAITING
          const [updated] = await tx
            .update(payments)
            .set({
              status: targetPaymentStatus,
              transactionReference: transactionReference.trim(),
              submittedAt: now,
              updatedAt: now,
            })
            .where(eq(payments.id, existingPayment.id))
            .returning();
          paymentRow = updated;
        }
      } else {
        // Create new payment row
        const [inserted] = await tx
          .insert(payments)
          .values({
            projectId: project.id,
            type: paymentType,
            expectedAmount,
            submittedAmount: null, // Client amounts are strictly ignored
            transactionReference: transactionReference.trim(),
            status: targetPaymentStatus,
            submittedAt: now,
          })
          .returning();
        paymentRow = inserted;
      }

      // Insert new payment_proofs record
      const [proofRow] = await tx
        .insert(paymentProofs)
        .values({
          paymentId: paymentRow.id,
          fileUrl: storageKey,
          fileType: fileType || storageCheck.contentType || "image/png",
          fileSize: fileSize || storageCheck.size || 0,
          uploadedAt: now,
        })
        .returning();

      // Query all admins and create transactional notifications
      const adminUsers = await tx
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.role, "ADMIN"));

      for (const admin of adminUsers) {
        await tx.insert(notifications).values({
          userId: admin.userId,
          message: `New payment proof submitted for project "${project.title}" (${project.projectCode}) - [${paymentType}]. Review pending.`,
          read: false,
        });
      }

      return {
        type: "SUCCESS" as const,
        payment: paymentRow,
        proof: proofRow,
        isLate,
      };
    });

    if (txResult.type === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (txResult.type === "INVALID_AMOUNT") {
      return NextResponse.json({ error: txResult.message }, { status: 409 });
    }

    if (txResult.type === "CONFLICT") {
      return NextResponse.json({ error: txResult.message }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      payment: txResult.payment,
      proof: txResult.proof,
      isLate: txResult.isLate,
      message: txResult.isLate
        ? "Payment proof submitted after deadline. Requires administrative review."
        : "Payment proof submitted successfully and is pending review.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Payments/Proof] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while submitting payment proof." },
      { status: 500 }
    );
  }
}
