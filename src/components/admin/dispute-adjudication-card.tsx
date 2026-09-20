"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_RESOLUTION_ACTIONS, AdminResolutionAction } from "@/lib/projects/dispute-validation";

export interface DisputeWithContext {
  id: string;
  projectId: string;
  reason: string;
  description: string;
  status: "OPEN" | "RESOLVED" | "CANCELLED";
  preDisputeStatus?: string | null;
  resolutionNote?: string | null;
  createdAt: string | Date;
  resolvedAt?: string | Date | null;
  raiserName: string;
  raiserEmail: string;
  raiserRole: "CLIENT" | "BUILDER" | "ADMIN";
  project: {
    id: string;
    projectCode: string;
    title: string;
    status: string;
    clientName: string;
    clientEmail: string;
    builderName?: string | null;
    builderEmail?: string | null;
  };
  scopeSnapshot?: {
    versionNumber: number;
    title: string;
    description: string;
    totalPrice: number;
    advanceAmount: number;
    remainingAmount: number;
    deliverableRequirements?: string | null;
  } | null;
  deliverable?: {
    githubUrl: string;
    repoType: string;
    branch: string;
    commitRef: string;
    description: string;
    implementedFeatures: string;
    deploymentUrl?: string | null;
    documentationUrl?: string | null;
    pptUrl?: string | null;
    demoUrl?: string | null;
  } | null;
  payments: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    proofUrl?: string | null;
    utrNumber?: string | null;
  }>;
  messages: Array<{
    id: string;
    senderName: string;
    senderRole: "CLIENT" | "BUILDER" | "ADMIN";
    body: string;
    createdAt: string | Date;
  }>;
}

export function DisputeAdjudicationCard({ dispute }: { dispute: DisputeWithContext }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"summary" | "scope" | "deliverables" | "payments" | "messages">("summary");
  const [action, setAction] = useState<AdminResolutionAction>("RETURN_TO_DEVELOPMENT");
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isOpen = dispute.status === "OPEN";

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/disputes/${dispute.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resolutionNote }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resolve dispute.");
      }

      setSuccess("Dispute successfully resolved.");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
      {/* Top Banner */}
      <div className="p-6 border-b border-gray-200 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-800">
              {dispute.project.projectCode}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                dispute.status === "OPEN"
                  ? "bg-red-100 text-red-800 border-red-200"
                  : dispute.status === "RESOLVED"
                  ? "bg-green-100 text-green-800 border-green-200"
                  : "bg-gray-100 text-gray-700 border-gray-200"
              }`}
            >
              Dispute {dispute.status}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
              Project: {dispute.project.status}
            </span>
          </div>

          <h2 className="text-lg font-bold text-gray-900">
            {dispute.project.title}
          </h2>

          <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <strong>Raiser:</strong> {dispute.raiserName} ({dispute.raiserRole})
            </span>
            <span>
              <strong>Client:</strong> {dispute.project.clientName}
            </span>
            <span>
              <strong>Builder:</strong> {dispute.project.builderName || "Unassigned"}
            </span>
            <span>
              <strong>Filed:</strong> {new Date(dispute.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/projects/${dispute.projectId}/messages`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 border border-gray-300 hover:bg-white text-xs font-semibold rounded-lg text-gray-700 transition"
          >
            Open Live Thread ↗
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6 gap-6 text-xs font-semibold text-gray-500 overflow-x-auto">
        <button
          onClick={() => setActiveTab("summary")}
          className={`py-3 border-b-2 transition ${
            activeTab === "summary"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent hover:text-gray-900"
          }`}
        >
          Dispute Reason & Notes
        </button>
        <button
          onClick={() => setActiveTab("scope")}
          className={`py-3 border-b-2 transition ${
            activeTab === "scope"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent hover:text-gray-900"
          }`}
        >
          Scope Snapshot ({dispute.scopeSnapshot ? `v${dispute.scopeSnapshot.versionNumber}` : "None"})
        </button>
        <button
          onClick={() => setActiveTab("deliverables")}
          className={`py-3 border-b-2 transition ${
            activeTab === "deliverables"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent hover:text-gray-900"
          }`}
        >
          Deliverables ({dispute.deliverable ? "Submitted" : "None"})
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`py-3 border-b-2 transition ${
            activeTab === "payments"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent hover:text-gray-900"
          }`}
        >
          Payments & Proofs ({dispute.payments.length})
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={`py-3 border-b-2 transition ${
            activeTab === "messages"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent hover:text-gray-900"
          }`}
        >
          Messages Thread ({dispute.messages.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-6 bg-gray-50/25">
        {/* Tab 1: Dispute Summary */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
                  Claimed Reason
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  {dispute.reason.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {dispute.description}
              </div>
            </div>

            {dispute.preDisputeStatus && (
              <div className="text-xs text-gray-500">
                <strong>Pre-Dispute Status:</strong> <span className="font-mono">{dispute.preDisputeStatus}</span>
              </div>
            )}

            {dispute.resolutionNote && (
              <div className="bg-green-50/80 border border-green-200 rounded-lg p-4">
                <span className="text-xs font-bold text-green-900 uppercase tracking-wider block mb-1">
                  Resolution Ruling
                </span>
                <p className="text-sm text-green-800 whitespace-pre-wrap">
                  {dispute.resolutionNote}
                </p>
                {dispute.resolvedAt && (
                  <span className="text-[11px] text-green-600 block mt-2">
                    Adjudicated on {new Date(dispute.resolvedAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Scope Snapshot */}
        {activeTab === "scope" && (
          <div>
            {dispute.scopeSnapshot ? (
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <h4 className="font-bold text-gray-900 text-sm">
                    {dispute.scopeSnapshot.title} (Scope Version {dispute.scopeSnapshot.versionNumber})
                  </h4>
                  <span className="text-sm font-bold text-gray-900">
                    Total: ₹{dispute.scopeSnapshot.totalPrice} (Advance: ₹{dispute.scopeSnapshot.advanceAmount}, Remaining: ₹{dispute.scopeSnapshot.remainingAmount})
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Description</span>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{dispute.scopeSnapshot.description}</p>
                </div>
                {dispute.scopeSnapshot.deliverableRequirements && (
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Deliverable Requirements</span>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{dispute.scopeSnapshot.deliverableRequirements}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No scope snapshot found for this project.</p>
            )}
          </div>
        )}

        {/* Tab 3: Deliverables */}
        {activeTab === "deliverables" && (
          <div>
            {dispute.deliverable ? (
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase block">GitHub Repository</span>
                    <a
                      href={dispute.deliverable.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono font-semibold text-blue-600 hover:underline break-all"
                    >
                      {dispute.deliverable.githubUrl}
                    </a>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase block">Branch & Commit</span>
                    <span className="text-sm font-mono text-gray-800">
                      {dispute.deliverable.branch} @ {dispute.deliverable.commitRef} ({dispute.deliverable.repoType})
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Implemented Features</span>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                    {dispute.deliverable.implementedFeatures}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Delivery Instructions</span>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                    {dispute.deliverable.description}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No deliverables have been submitted yet.</p>
            )}
          </div>
        )}

        {/* Tab 4: Payments & Proofs (Short-TTL Presigned URLs) */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            {dispute.payments.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No payment records found.</p>
            ) : (
              dispute.payments.map((p) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-gray-900">{p.type} Payment</span>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        ₹{p.amount}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.status === "VERIFIED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {p.status}
                      </span>
                    </div>
                    {p.utrNumber && (
                      <span className="text-xs text-gray-500">UTR / Ref: <span className="font-mono">{p.utrNumber}</span></span>
                    )}
                  </div>

                  {p.proofUrl ? (
                    <a
                      href={p.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg transition"
                    >
                      View Presigned Proof Screenshot ↗
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No proof file uploaded</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 5: Messages Thread */}
        {activeTab === "messages" && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto space-y-3">
            {dispute.messages.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No messages found in project thread.</p>
            ) : (
              dispute.messages.map((m) => (
                <div key={m.id} className="border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className="font-bold text-gray-800">{m.senderName}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-gray-100 text-gray-600 font-bold border uppercase">
                      {m.senderRole}
                    </span>
                    <span className="text-gray-400 text-[10px]">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Adjudication Action Form (Only for OPEN disputes) */}
      {isOpen && (
        <form onSubmit={handleResolve} className="p-6 bg-gray-50 border-t border-gray-200 space-y-4">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Adjudicate Dispute
          </h3>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label
              className={`p-3 border rounded-xl cursor-pointer transition text-xs flex flex-col justify-between ${
                action === "RETURN_TO_DEVELOPMENT"
                  ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="radio"
                  name={`action-${dispute.id}`}
                  value="RETURN_TO_DEVELOPMENT"
                  checked={action === "RETURN_TO_DEVELOPMENT"}
                  onChange={() => setAction("RETURN_TO_DEVELOPMENT")}
                />
                <span className="font-bold text-gray-900">Return to Development</span>
              </div>
              <span className="text-gray-500 text-[11px]">
                Restores project to IN_PROGRESS. Builder must address feedback.
              </span>
            </label>

            <label
              className={`p-3 border rounded-xl cursor-pointer transition text-xs flex flex-col justify-between ${
                action === "RETURN_TO_DELIVERY"
                  ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="radio"
                  name={`action-${dispute.id}`}
                  value="RETURN_TO_DELIVERY"
                  checked={action === "RETURN_TO_DELIVERY"}
                  onChange={() => setAction("RETURN_TO_DELIVERY")}
                />
                <span className="font-bold text-gray-900">Return to Delivery</span>
              </div>
              <span className="text-gray-500 text-[11px]">
                Restores project to DELIVERY_UNLOCKED. Requires verified final payment.
              </span>
            </label>

            <label
              className={`p-3 border rounded-xl cursor-pointer transition text-xs flex flex-col justify-between ${
                action === "CANCEL_PROJECT"
                  ? "border-red-600 bg-red-50/60 ring-2 ring-red-500/20"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="radio"
                  name={`action-${dispute.id}`}
                  value="CANCEL_PROJECT"
                  checked={action === "CANCEL_PROJECT"}
                  onChange={() => setAction("CANCEL_PROJECT")}
                />
                <span className="font-bold text-red-700">Cancel Project</span>
              </div>
              <span className="text-gray-500 text-[11px]">
                Terminates project into CANCELLED. Dispute resolution ends engagement.
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Resolution Note & Ruling <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              minLength={10}
              maxLength={3000}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Explain the administrative verdict and instructions for the client and builder..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || resolutionNote.length < 10}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {loading ? "Adjudicating..." : "Resolve & Commit Verdict"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
