import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projects, users, payments, notifications } from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { computeEffectiveStatus, reconcileProjectStatusInDb } from "@/lib/project-status";
import { PortalHeader } from "@/components/navigation/portal-header";
import { ClientDashboardView, ClientProjectItem, ClientNotificationItem } from "@/components/dashboard/client-dashboard-view";

export default async function ClientDashboardPage() {
  // 1. Server-Side Authentication Guard
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  // 2. Client Role Verification
  const isClient = auth.roles.includes("CLIENT");
  if (!isClient) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">
            Only accounts with the Client role can access the Client Portal.
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

  // 3. Query Client's Projects with Builder information (Strictly scoped by session user ID)
  const rawProjects = await db
    .select({
      project: projects,
      builder: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(projects)
    .leftJoin(users, eq(projects.builderId, users.id))
    .where(eq(projects.clientId, auth.user.id))
    .orderBy(desc(projects.createdAt));

  // 4. Reconcile Effective Status for Any Expired / Overdue Projects
  const now = new Date();
  const projectIds: string[] = [];

  const reconciledProjects = await Promise.all(
    rawProjects.map(async (row) => {
      const p = row.project;
      projectIds.push(p.id);

      const effective = computeEffectiveStatus(p, now);
      if (effective.changed) {
        const newStatus = await reconcileProjectStatusInDb(p.id, now);
        return {
          ...row,
          project: {
            ...p,
            status: newStatus,
          },
        };
      }
      return {
        ...row,
        project: {
          ...p,
          status: effective.status,
        },
      };
    })
  );

  // 5. Query Payments for Client's Projects (if any projects exist)
  const projectPaymentsMap = new Map<string, any>();
  if (projectIds.length > 0) {
    const paymentRows = await db
      .select()
      .from(payments)
      .where(inArray(payments.projectId, projectIds))
      .orderBy(desc(payments.createdAt));

    for (const pay of paymentRows) {
      if (!projectPaymentsMap.has(pay.projectId)) {
        projectPaymentsMap.set(pay.projectId, pay);
      }
    }
  }

  // 6. Query Client Notifications
  const userNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, auth.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  // 7. Format serializable items for Client View
  const formattedProjects: ClientProjectItem[] = reconciledProjects.map((row) => {
    const p = row.project;
    const pay = projectPaymentsMap.get(p.id) || null;

    return {
      id: p.id,
      projectCode: p.projectCode,
      title: p.title,
      subject: p.subject,
      description: p.description,
      techStack: p.techStack,
      budgetMin: p.budgetMin,
      budgetMax: p.budgetMax,
      totalPrice: p.totalPrice,
      advanceAmount: p.advanceAmount,
      remainingAmount: p.remainingAmount,
      status: p.status,
      requestedCompletionDate: p.requestedCompletionDate || null,
      developmentDeadline: p.developmentDeadline ? p.developmentDeadline.toISOString() : null,
      advancePaymentDeadline: p.advancePaymentDeadline ? p.advancePaymentDeadline.toISOString() : null,
      builderAcceptedAt: p.builderAcceptedAt ? p.builderAcceptedAt.toISOString() : null,
      submittedAt: p.submittedAt ? p.submittedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      builder: row.builder?.id ? row.builder : null,
      payment: pay
        ? {
            id: pay.id,
            type: pay.type,
            expectedAmount: pay.expectedAmount,
            submittedAmount: pay.submittedAmount,
            status: pay.status,
            transactionReference: pay.transactionReference,
          }
        : null,
    };
  });

  const formattedNotifications: ClientNotificationItem[] = userNotifications.map((n) => ({
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
        currentPortalTitle="Client Portal"
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <ClientDashboardView
          user={auth.user}
          projects={formattedProjects}
          notifications={formattedNotifications}
        />
      </main>
    </div>
  );
}
