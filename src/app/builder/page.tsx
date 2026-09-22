import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { projects, projectRequirements, notifications } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authorization";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { PortalHeader } from "@/components/navigation/portal-header";
import {
  BuilderDashboardView,
  BuilderProjectCardItem,
  BuilderNotificationItem,
} from "@/components/builder/builder-dashboard-view";

export default async function BuilderPortalPage() {
  // 1. Server-Side Authentication Guard
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  // 2. Centralized Authorization: BUILDER Role Verification
  const isAuthorized = can(auth, "PROJECT_LIST_AVAILABLE").allowed;
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            Only accounts with the Builder role can access the Builder Portal.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
          >
            Return Home
          </Link>
        </div>
      </main>
    );
  }

  const now = new Date();

  // 3. Query Candidate Available Projects
  const candidateProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.status, "AVAILABLE"))
    .orderBy(desc(projects.submittedAt));

  // 4. Reconcile Lazy Expiry for Available Projects
  const availableProjects: BuilderProjectCardItem[] = [];

  for (const proj of candidateProjects) {
    const effective = computeEffectiveStatus(proj, now);

    if (effective.changed) {
      await reconcileProjectStatusInDb(proj.id, now);
      continue;
    }

    if (effective.status === "AVAILABLE") {
      const [reqs] = await db
        .select({ count: count() })
        .from(projectRequirements)
        .where(eq(projectRequirements.projectId, proj.id));

      availableProjects.push({
        id: proj.id,
        projectCode: proj.projectCode,
        title: proj.title,
        subject: proj.subject,
        description: proj.description,
        techStack: proj.techStack,
        budgetMin: proj.budgetMin,
        budgetMax: proj.budgetMax,
        totalPrice: proj.totalPrice,
        advanceAmount: proj.advanceAmount,
        remainingAmount: proj.remainingAmount,
        status: "AVAILABLE",
        requestedCompletionDate: proj.requestedCompletionDate || null,
        developmentDeadline: proj.developmentDeadline ? proj.developmentDeadline.toISOString() : null,
        advancePaymentDeadline: proj.advancePaymentDeadline ? proj.advancePaymentDeadline.toISOString() : null,
        acceptanceDeadline: proj.acceptanceDeadline ? proj.acceptanceDeadline.toISOString() : null,
        lastProgressUpdateAt: proj.lastProgressUpdateAt ? proj.lastProgressUpdateAt.toISOString() : null,
        requirementCount: reqs ? Number(reqs.count) : 0,
        isAssignedToMe: false,
        submittedAt: proj.submittedAt ? proj.submittedAt.toISOString() : null,
        createdAt: proj.createdAt.toISOString(),
      });
    }
  }

  // 5. Query Builder's Assigned Projects (Strictly isolated by session builder ID)
  const assignedCandidateProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.builderId, auth.user.id))
    .orderBy(desc(projects.updatedAt));

  const myProjects: BuilderProjectCardItem[] = [];

  for (const proj of assignedCandidateProjects) {
    const effective = computeEffectiveStatus(proj, now);
    let finalStatus = effective.status;

    if (effective.changed) {
      finalStatus = await reconcileProjectStatusInDb(proj.id, now);
    }

    const [reqs] = await db
      .select({ count: count() })
      .from(projectRequirements)
      .where(eq(projectRequirements.projectId, proj.id));

    myProjects.push({
      id: proj.id,
      projectCode: proj.projectCode,
      title: proj.title,
      subject: proj.subject,
      description: proj.description,
      techStack: proj.techStack,
      budgetMin: proj.budgetMin,
      budgetMax: proj.budgetMax,
      totalPrice: proj.totalPrice,
      advanceAmount: proj.advanceAmount,
      remainingAmount: proj.remainingAmount,
      status: finalStatus,
      requestedCompletionDate: proj.requestedCompletionDate || null,
      developmentDeadline: proj.developmentDeadline ? proj.developmentDeadline.toISOString() : null,
      advancePaymentDeadline: proj.advancePaymentDeadline ? proj.advancePaymentDeadline.toISOString() : null,
      acceptanceDeadline: proj.acceptanceDeadline ? proj.acceptanceDeadline.toISOString() : null,
      lastProgressUpdateAt: proj.lastProgressUpdateAt ? proj.lastProgressUpdateAt.toISOString() : null,
      requirementCount: reqs ? Number(reqs.count) : 0,
      isAssignedToMe: true,
      submittedAt: proj.submittedAt ? proj.submittedAt.toISOString() : null,
      createdAt: proj.createdAt.toISOString(),
    });
  }

  // 6. Query Builder Notifications
  const builderNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, auth.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  const formattedNotifications: BuilderNotificationItem[] = builderNotifications.map((n) => ({
    id: n.id,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Builder Dashboard"
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <BuilderDashboardView
          user={auth.user}
          availableProjects={availableProjects}
          myProjects={myProjects}
          notifications={formattedNotifications}
        />
      </main>
    </div>
  );
}
