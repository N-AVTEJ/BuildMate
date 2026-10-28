import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { builderApplications, notifications, users } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";

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
    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'APPROVE' or 'REJECT'." },
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

    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    // 3. Update application status
    // Invariant (Phase 14 Lockdown):
    // Approve action does NOT auto-provision anything in this phase.
    // It flips status to APPROVED and sends a notification to the admin with provisioning instructions.
    const [updatedApp] = await db
      .update(builderApplications)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(builderApplications.id, applicationId))
      .returning();

    // 4. Send notification:
    // If APPROVED: notify admin with manual provisioning CLI instructions.
    // If REJECTED: notify applicant (in-app if user account exists, and log notice). No account is created.
    if (action === "APPROVE") {
      await db.insert(notifications).values({
        userId: auth.user.id,
        message: `Builder application for ${app.name} (${app.email}) was APPROVED. Run "npx tsx scripts/provision-builder.ts ${app.email}" to provision account.`,
      });
    } else {
      const [applicantUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, app.email.toLowerCase()))
        .limit(1);

      if (applicantUser) {
        await db.insert(notifications).values({
          userId: applicantUser.id,
          message: `Your builder application for BuildMate has been reviewed and was not accepted at this time.`,
        });
      }
      console.log(`[Admin/BuilderApplications] Rejection notice dispatched to applicant <${app.email}> for application ${applicationId}.`);
    }

    return NextResponse.json({
      success: true,
      message: `Application ${action.toLowerCase()}d successfully.`,
      application: updatedApp,
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/BuilderApplications/Update] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to update application." }, { status: 500 });
  }
}
