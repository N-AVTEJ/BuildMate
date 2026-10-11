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
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-2 border-black p-8 text-center neo-shadow-lg">
          <div className="w-14 h-14 bg-[#ffe17c] text-[#171e19] border-2 border-black flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            !
          </div>
          <h1 className="text-2xl font-cabinet font-black text-[#171e19] mb-2 uppercase tracking-wide">
            Access Denied
          </h1>
          <p className="text-sm font-bold text-gray-700 mb-6">
            Only accounts with the Client role can access the Client Portal.
          </p>
          <Link
            href="/"
            className="neo-btn inline-block px-5 py-2.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
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
    <div className="min-h-screen bg-[#fffdf0] neo-dots">
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
