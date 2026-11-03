import { NextResponse } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { builderApplications, notifications, users, userRoles, emailVerificationTokens } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { hashToken } from "@/lib/auth/session";
import { sendBuilderSetupEmail } from "@/lib/email/resend";
import { notify } from "@/lib/notify";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Centralized Authorization: Strictly ADMIN role
    const auth = await requireRole(["ADMIN"]);

    const { id: applicationId } = await params;
    if (!applicationId) {
      return NextResponse.json({ error: "Application ID is required." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { action } = body;
    if (action !== "APPROVE" && action !== "REJECT" && action !== "RESEND_SETUP") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'APPROVE', 'REJECT', or 'RESEND_SETUP'." },
        { status: 400 }
      );
    }

    // 2. Fetch existing application
    const [app] = await db
      .select()
      .from(builderApplications)
      .where(eq(builderApplications.id, applicationId))
      .limit(1);

    if (!app) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const normalizedEmail = app.email.trim().toLowerCase();

    // Helper: provision user, assign BUILDER role, generate setup token and send email
    const provisionAndSendSetup = async () => {
      let [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (!userRecord) {
        const [created] = await db
          .insert(users)
          .values({
            name: app.name,
            email: normalizedEmail,
            passwordHash: "PENDING_SETUP",
            emailVerified: true,
          })
          .returning();
        userRecord = created;
      } else if (!userRecord.emailVerified) {
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, userRecord.id));
      }

      // Add BUILDER role
      await db
        .insert(userRoles)
        .values({
          userId: userRecord.id,
          role: "BUILDER",
        })
        .onConflictDoNothing();

      // Generate 7-day secure one-time setup token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db
        .update(emailVerificationTokens)
        .set({ used: true })
        .where(
          and(
            eq(emailVerificationTokens.userId, userRecord.id),
            eq(emailVerificationTokens.used, false)
          )
        );

      await db.insert(emailVerificationTokens).values({
        userId: userRecord.id,
        tokenHash,
        expiresAt,
        used: false,
      });

      // Dispatch setup link email via Resend
      await sendBuilderSetupEmail(normalizedEmail, rawToken, app.name);

      return { userRecord, rawToken };
    };

    if (action === "RESEND_SETUP") {
      if (app.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Cannot resend setup link for an application that is not approved." },
          { status: 400 }
        );
      }

      const { rawToken } = await provisionAndSendSetup();

      return NextResponse.json({
        success: true,
        message: `Account setup link re-sent to ${normalizedEmail}.`,
        setupToken: rawToken,
      });
    }

    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    // 3. Update application status
    const [updatedApp] = await db
      .update(builderApplications)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(builderApplications.id, applicationId))
      .returning();

    let setupToken: string | undefined;

    if (action === "APPROVE") {
      const provisioned = await provisionAndSendSetup();
      setupToken = provisioned.rawToken;

      // Backend authority: Notify newly provisioned builder
      await notify(provisioned.userRecord.id, "BUILDER_APPROVED", {
        title: "Builder Application Approved",
        body: "Congratulations! Your builder application has been approved. Please set up your password.",
        url: "/builder/login",
      });

      await db.insert(notifications).values({
        userId: auth.user.id,
        message: `Builder account for ${app.name} (${normalizedEmail}) has been provisioned and an account setup invitation link was dispatched.`,
      });
    } else {
      const [applicantUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (applicantUser) {
        await db.insert(notifications).values({
          userId: applicantUser.id,
          message: `Your builder application for BuildMate has been reviewed and was not accepted at this time.`,
        });
      }
      console.log(`[Admin/BuilderApplications] Rejection notice dispatched to applicant <${normalizedEmail}> for application ${applicationId}.`);
    }

    return NextResponse.json({
      success: true,
      message: `Application ${action.toLowerCase()}d successfully.`,
      application: updatedApp,
      setupToken,
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/BuilderApplications/Update] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to update application." }, { status: 500 });
  }
}
