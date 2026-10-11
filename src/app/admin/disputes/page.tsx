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
import { can } from "@/lib/authorization";
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

  // Central authorization check: ADMIN role
  const isAuthorized = can(auth, "ADMIN_VIEW_DISPUTES").allowed;
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#fffdf0] neo-dots flex items-center justify-center p-4 font-body text-[#171e19]">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-black neo-shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-rose-200 border-2 border-black rounded-xl text-black flex items-center justify-center mx-auto mb-4 font-black text-2xl neo-shadow-sm">
            !
          </div>
          <h1 className="font-heading font-black text-2xl text-black mb-2">Access Denied</h1>
          <p className="text-sm text-black/70 font-medium mb-6 leading-relaxed">
            Administrator privileges are required to access this portal.
          </p>
          <Link
            href="/"
            className="neo-btn inline-block px-5 py-2.5 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl"
          >
            Return Home
          </Link>
        </div>
      </main>
    );
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
    <div className="min-h-screen bg-[#fffdf0] neo-dots font-body text-[#171e19] selection:bg-black selection:text-white pb-16">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle="Admin Portal"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-6 flex items-center gap-2 text-xs font-heading font-black uppercase tracking-wider text-black/60">
          <Link href="/admin" className="hover:text-black hover:underline">
            Admin Dashboard
          </Link>
          <span>/</span>
          <span className="text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded">Dispute Mediation</span>
        </div>

        <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 mb-8 neo-shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-black tracking-tight">
              Dispute Investigation & Resolution
            </h1>
            <p className="text-sm text-black/70 font-semibold mt-1">
              Unified mediation dashboard with full project scope, deliverables, payment proofs, and messages.
            </p>
          </div>

          <div>
            <span className="px-4 py-1.5 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-rose-200 text-black border-2 border-black neo-shadow-sm">
              {openCount} Open Dispute{openCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {fullDisputes.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-black p-12 text-center neo-shadow-lg">
            <span className="text-4xl mb-3 block">⚖️</span>
            <h3 className="text-xl font-heading font-black text-black">No disputes found</h3>
            <p className="text-xs text-black/60 font-semibold mt-1">
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
