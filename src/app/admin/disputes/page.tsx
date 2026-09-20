import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  disputes,
  projects,
  users,
  scopeVersions,
  deliverables,
  payments,
  paymentProofs,
  messages,
} from "@/db/schema";
import { getOptionalAuth } from "@/lib/auth/guards";
import { PortalHeader } from "@/components/navigation/portal-header";
import {
  DisputeAdjudicationCard,
  DisputeWithContext,
} from "@/components/admin/dispute-adjudication-card";
import { getDownloadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  if (!auth.roles.includes("ADMIN")) {
    redirect("/dashboard");
  }

  // 1. Fetch all disputes with project and user details
  const disputeRows = await db
    .select({
      id: disputes.id,
      projectId: disputes.projectId,
      reason: disputes.reason,
      description: disputes.description,
      status: disputes.status,
      preDisputeStatus: disputes.preDisputeStatus,
      resolutionNote: disputes.resolutionNote,
      createdAt: disputes.createdAt,
      resolvedAt: disputes.resolvedAt,
      raisedById: disputes.raisedBy,
      raiserName: users.name,
      raiserEmail: users.email,
      projectCode: projects.projectCode,
      projectTitle: projects.title,
      projectStatus: projects.status,
      clientId: projects.clientId,
      builderId: projects.builderId,
    })
    .from(disputes)
    .innerJoin(projects, eq(disputes.projectId, projects.id))
    .innerJoin(users, eq(disputes.raisedBy, users.id))
    .orderBy(desc(disputes.createdAt));

  // 2. Hydrate full project context for each dispute
  const fullDisputes: DisputeWithContext[] = [];

  for (const row of disputeRows) {
    // Client & Builder user info
    const [clientUser] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, row.clientId))
      .limit(1);

    let builderUser: { name: string; email: string } | null = null;
    if (row.builderId) {
      const [b] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, row.builderId))
        .limit(1);
      builderUser = b || null;
    }

    // Determine raiser role
    let raiserRole: "CLIENT" | "BUILDER" | "ADMIN" = "CLIENT";
    if (row.raisedById === row.builderId) {
      raiserRole = "BUILDER";
    } else if (row.raisedById === row.clientId) {
      raiserRole = "CLIENT";
    } else {
      raiserRole = "ADMIN";
    }

    // Latest Scope Snapshot
    const [latestScope] = await db
      .select({
        versionNumber: scopeVersions.versionNumber,
        requirementsSnapshot: scopeVersions.requirementsSnapshot,
        quotationSnapshot: scopeVersions.quotationSnapshot,
        projectSnapshot: scopeVersions.projectSnapshot,
      })
      .from(scopeVersions)
      .where(eq(scopeVersions.projectId, row.projectId))
      .orderBy(desc(scopeVersions.versionNumber))
      .limit(1);

    const projectSnap = (latestScope?.projectSnapshot as any) || {};
    const quoteSnap = (latestScope?.quotationSnapshot as any) || {};

    const formattedScope = latestScope
      ? {
          versionNumber: latestScope.versionNumber,
          title: projectSnap.title || row.projectTitle,
          description: projectSnap.description || "",
          totalPrice: quoteSnap.totalPrice || 0,
          advanceAmount: quoteSnap.advanceAmount || 0,
          remainingAmount: quoteSnap.remainingAmount || 0,
          deliverableRequirements: projectSnap.deliverableRequirements || null,
        }
      : null;

    // Deliverables
    const [deliverableRow] = await db
      .select({
        githubUrl: deliverables.githubUrl,
        repoType: deliverables.repoType,
        branch: deliverables.branch,
        commitRef: deliverables.commitRef,
        description: deliverables.description,
        implementedFeatures: deliverables.implementedFeatures,
        deploymentUrl: deliverables.deploymentUrl,
        documentationUrl: deliverables.documentationUrl,
        pptUrl: deliverables.pptUrl,
        demoUrl: deliverables.demoUrl,
      })
      .from(deliverables)
      .where(eq(deliverables.projectId, row.projectId))
      .limit(1);

    // Payments & Proofs (using presigned short-TTL URLs)
    const paymentRows = await db
      .select({
        id: payments.id,
        type: payments.type,
        expectedAmount: payments.expectedAmount,
        transactionReference: payments.transactionReference,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.projectId, row.projectId));

    const hydratedPayments: DisputeWithContext["payments"] = [];

    for (const p of paymentRows) {
      const [proof] = await db
        .select({
          fileUrl: paymentProofs.fileUrl,
        })
        .from(paymentProofs)
        .where(eq(paymentProofs.paymentId, p.id))
        .orderBy(desc(paymentProofs.uploadedAt))
        .limit(1);

      let presignedProofUrl: string | null = null;
      if (proof?.fileUrl) {
        try {
          presignedProofUrl = await getDownloadUrl(proof.fileUrl, 300);
        } catch {
          presignedProofUrl = null;
        }
      }

      hydratedPayments.push({
        id: p.id,
        type: p.type,
        amount: p.expectedAmount,
        status: p.status,
        proofUrl: presignedProofUrl,
        utrNumber: p.transactionReference || null,
      });
    }

    // Message thread history
    const messageRows = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderName: users.name,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.projectId, row.projectId))
      .orderBy(desc(messages.createdAt))
      .limit(20);

    const formattedMessages = messageRows.reverse().map((m) => {
      let roleLabel: "CLIENT" | "BUILDER" | "ADMIN" = "CLIENT";
      if (m.senderId === row.builderId) {
        roleLabel = "BUILDER";
      } else if (m.senderId === row.clientId) {
        roleLabel = "CLIENT";
      } else {
        roleLabel = "ADMIN";
      }

      return {
        id: m.id,
        senderName: m.senderName,
        senderRole: roleLabel,
        body: m.body,
        createdAt: m.createdAt,
      };
    });

    fullDisputes.push({
      id: row.id,
      projectId: row.projectId,
      reason: row.reason,
      description: row.description,
      status: row.status as "OPEN" | "RESOLVED" | "CANCELLED",
      preDisputeStatus: row.preDisputeStatus,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      raiserName: row.raiserName,
      raiserEmail: row.raiserEmail,
      raiserRole,
      project: {
        id: row.projectId,
        projectCode: row.projectCode,
        title: row.projectTitle,
        status: row.projectStatus,
        clientName: clientUser?.name || "Client",
        clientEmail: clientUser?.email || "",
        builderName: builderUser?.name || null,
        builderEmail: builderUser?.email || null,
      },
      scopeSnapshot: formattedScope || null,
      deliverable: deliverableRow || null,
      payments: hydratedPayments,
      messages: formattedMessages,
    });
  }

  const openCount = fullDisputes.filter((d) => d.status === "OPEN").length;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Admin Portal"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/admin/dashboard" className="hover:text-blue-600">
            Admin Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Dispute Mediation</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Dispute Investigation & Resolution
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Unified mediation dashboard with full project scope, deliverables, payment proofs, and messages.
            </p>
          </div>

          <div>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
              {openCount} Open Dispute{openCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {fullDisputes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            <span className="text-4xl mb-3 block">⚖️</span>
            <h3 className="text-base font-bold text-gray-800">No disputes found</h3>
            <p className="text-xs text-gray-400 mt-1">
              No formal disputes have been opened across any projects.
            </p>
          </div>
        ) : (
          <div>
            {fullDisputes.map((dispute) => (
              <DisputeAdjudicationCard key={dispute.id} dispute={dispute} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
