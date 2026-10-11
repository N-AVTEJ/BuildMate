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
    <div className="bg-white rounded-2xl border-2 border-black neo-shadow-lg overflow-hidden mb-8 font-body text-[#171e19]">
      {/* Top Banner */}
      <div className="p-6 border-b-2 border-black/10 bg-[#fffdf0] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-black text-[#ffe17c] border border-black">
              {dispute.project.projectCode}
            </span>
            <span
              className={`text-xs font-heading font-black px-3 py-0.5 rounded-full border-2 border-black uppercase neo-shadow-sm ${
                dispute.status === "OPEN"
                  ? "bg-rose-200 text-black"
                  : dispute.status === "RESOLVED"
                  ? "bg-emerald-300 text-black"
                  : "bg-white text-black"
              }`}
            >
              Dispute {dispute.status}
            </span>
            <span className="text-xs font-heading font-black px-2.5 py-0.5 rounded bg-[#ffe17c] text-black border border-black">
              Project: {dispute.project.status}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-heading font-black text-black">
            {dispute.project.title}
          </h2>

          <div className="text-xs text-black/70 font-semibold mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <strong className="text-black">Raiser:</strong> {dispute.raiserName} ({dispute.raiserRole})
            </span>
            <span>
              <strong className="text-black">Client:</strong> {dispute.project.clientName}
            </span>
            <span>
              <strong className="text-black">Builder:</strong> {dispute.project.builderName || "Unassigned"}
            </span>
            <span>
              <strong className="text-black">Filed:</strong> {new Date(dispute.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/projects/${dispute.projectId}/messages`}
            target="_blank"
            rel="noopener noreferrer"
            className="neo-btn px-4 py-2 border-2 border-black bg-white hover:bg-[#ffe17c] text-xs font-heading font-black uppercase tracking-wider rounded-xl text-black transition"
          >
            Open Live Thread ↗
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b-2 border-black/10 bg-white px-6 gap-6 text-xs font-heading font-black uppercase tracking-wider overflow-x-auto">
        <button
          onClick={() => setActiveTab("summary")}
          className={`py-3.5 border-b-2 transition ${
            activeTab === "summary"
              ? "border-black text-black bg-[#ffe17c]/20 px-2 rounded-t"
              : "border-transparent text-black/60 hover:text-black"
          }`}
        >
          Dispute Reason &amp; Notes
        </button>
        <button
          onClick={() => setActiveTab("scope")}
          className={`py-3.5 border-b-2 transition ${
            activeTab === "scope"
              ? "border-black text-black bg-[#ffe17c]/20 px-2 rounded-t"
              : "border-transparent text-black/60 hover:text-black"
          }`}
        >
          Scope Snapshot ({dispute.scopeSnapshot ? `v${dispute.scopeSnapshot.versionNumber}` : "None"})
        </button>
        <button
          onClick={() => setActiveTab("deliverables")}
          className={`py-3.5 border-b-2 transition ${
            activeTab === "deliverables"
              ? "border-black text-black bg-[#ffe17c]/20 px-2 rounded-t"
              : "border-transparent text-black/60 hover:text-black"
          }`}
        >
          Deliverables ({dispute.deliverable ? "Submitted" : "None"})
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`py-3.5 border-b-2 transition ${
            activeTab === "payments"
              ? "border-black text-black bg-[#ffe17c]/20 px-2 rounded-t"
              : "border-transparent text-black/60 hover:text-black"
          }`}
        >
          Payments &amp; Proofs ({dispute.payments.length})
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={`py-3.5 border-b-2 transition ${
            activeTab === "messages"
              ? "border-black text-black bg-[#ffe17c]/20 px-2 rounded-t"
              : "border-transparent text-black/60 hover:text-black"
          }`}
        >
          Messages Thread ({dispute.messages.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-6 sm:p-8 bg-white">
        {/* Tab 1: Dispute Summary */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            <div className="bg-[#fffdf0] border-2 border-black rounded-xl p-5 neo-shadow-sm space-y-3">
              <div>
                <span className="text-[11px] font-heading font-black text-black/60 uppercase tracking-wider block">
                  Category
                </span>
                <span className="text-base font-heading font-black text-black">
                  {dispute.reason.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-heading font-black text-black/60 uppercase tracking-wider block">
                  Raiser Explanation
                </span>
                <p className="text-sm font-medium text-black whitespace-pre-wrap leading-relaxed mt-1">
                  {dispute.description}
                </p>
              </div>
              {dispute.resolutionNote && (
                <div className="pt-3 border-t-2 border-black/10">
                  <span className="text-[11px] font-heading font-black text-emerald-800 uppercase tracking-wider block">
                    Adjudicated Ruling
                  </span>
                  <p className="text-sm font-medium text-black whitespace-pre-wrap leading-relaxed mt-1">
                    {dispute.resolutionNote}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Scope Snapshot */}
        {activeTab === "scope" && (
          <div>
            {!dispute.scopeSnapshot ? (
              <p className="text-xs text-black/60 font-semibold italic">No locked scope version exists for this project.</p>
            ) : (
              <div className="bg-[#fffdf0] border-2 border-black rounded-xl p-5 neo-shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading font-black text-base text-black">
                    {dispute.scopeSnapshot.title} (v{dispute.scopeSnapshot.versionNumber})
                  </h4>
                  <span className="font-heading font-black text-xs px-2.5 py-1 bg-[#ffe17c] border border-black rounded">
                    Total: ₹{dispute.scopeSnapshot.totalPrice.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-black/80 font-medium whitespace-pre-wrap leading-relaxed">
                  {dispute.scopeSnapshot.description}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Deliverables */}
        {activeTab === "deliverables" && (
          <div>
            {!dispute.deliverable ? (
              <p className="text-xs text-black/60 font-semibold italic">No deliverables have been submitted yet.</p>
            ) : (
              <div className="bg-[#fffdf0] border-2 border-black rounded-xl p-5 neo-shadow-sm space-y-3">
                <div>
                  <span className="text-[11px] font-heading font-black text-black/60 uppercase block">GitHub URL:</span>
                  <a
                    href={dispute.deliverable.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-black underline font-bold break-all"
                  >
                    {dispute.deliverable.githubUrl}
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono font-bold">
                  <div>Branch: {dispute.deliverable.branch}</div>
                  <div>Commit: {dispute.deliverable.commitRef}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Payments */}
        {activeTab === "payments" && (
          <div className="space-y-3">
            {dispute.payments.length === 0 ? (
              <p className="text-xs text-black/60 font-semibold italic">No payment records exist for this project.</p>
            ) : (
              dispute.payments.map((p) => (
                <div key={p.id} className="p-3.5 bg-[#fffdf0] rounded-xl border-2 border-black flex items-center justify-between text-xs">
                  <div>
                    <span className="font-heading font-black uppercase text-black mr-2">{p.type}</span>
                    <span className="font-mono font-black text-black">₹{p.amount.toLocaleString()}</span>
                  </div>
                  <span className="font-heading font-black text-[11px] uppercase bg-white border border-black px-2 py-0.5 rounded">
                    {p.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 5: Messages */}
        {activeTab === "messages" && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {dispute.messages.length === 0 ? (
              <p className="text-xs text-black/60 font-semibold italic">No messages found in project thread.</p>
            ) : (
              dispute.messages.map((m) => (
                <div key={m.id} className="border-b-2 border-black/10 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className="font-heading font-black text-black">{m.senderName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#ffe17c] text-black font-black border border-black uppercase">
                      {m.senderRole}
                    </span>
                    <span className="text-black/50 text-[10px] font-mono">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-black font-medium whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Adjudication Action Form (Only for OPEN disputes) */}
      {isOpen && (
        <form onSubmit={handleResolve} className="p-6 sm:p-8 bg-[#fffdf0] border-t-2 border-black space-y-5">
          <h3 className="text-base font-heading font-black text-black uppercase tracking-wider">
            Adjudicate Dispute
          </h3>

          {error && (
            <div className="p-3.5 bg-rose-200 border-2 border-black text-black text-xs font-bold rounded-xl neo-shadow-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-200 border-2 border-black text-black text-xs font-bold rounded-xl neo-shadow-sm">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label
              className={`p-4 border-2 border-black rounded-xl cursor-pointer transition text-xs flex flex-col justify-between neo-shadow-sm ${
                action === "RETURN_TO_DEVELOPMENT"
                  ? "bg-[#ffe17c]"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <input
                  type="radio"
                  name={`action-${dispute.id}`}
                  value="RETURN_TO_DEVELOPMENT"
                  checked={action === "RETURN_TO_DEVELOPMENT"}
                  onChange={() => setAction("RETURN_TO_DEVELOPMENT")}
                />
                <span className="font-heading font-black text-black">Return to Dev</span>
              </div>
              <span className="text-black/70 font-semibold text-[11px] leading-relaxed">
                Restores project to IN_PROGRESS. Builder addresses feedback.
              </span>
            </label>

            <label
              className={`p-4 border-2 border-black rounded-xl cursor-pointer transition text-xs flex flex-col justify-between neo-shadow-sm ${
                action === "RETURN_TO_DELIVERY"
                  ? "bg-[#ffe17c]"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <input
                  type="radio"
                  name={`action-${dispute.id}`}
                  value="RETURN_TO_DELIVERY"
                  checked={action === "RETURN_TO_DELIVERY"}
                  onChange={() => setAction("RETURN_TO_DELIVERY")}
                />
                <span className="font-heading font-black text-black">Return to Delivery</span>
              </div>
              <span className="text-black/70 font-semibold text-[11px] leading-relaxed">
                Restores project to DELIVERY_UNLOCKED. Requires verified payment.
              </span>
            </label>

            <label
              className={`p-4 border-2 border-black rounded-xl cursor-pointer transition text-xs flex flex-col justify-between neo-shadow-sm ${
                action === "CANCEL_PROJECT"
                  ? "bg-rose-200"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <input
                  type="radio"
                  name={`action-${dispute.id}`}
                  value="CANCEL_PROJECT"
                  checked={action === "CANCEL_PROJECT"}
                  onChange={() => setAction("CANCEL_PROJECT")}
                />
                <span className="font-heading font-black text-black">Cancel Project</span>
              </div>
              <span className="text-black/70 font-semibold text-[11px] leading-relaxed">
                Terminates project into CANCELLED. Ends engagement.
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
              Resolution Note &amp; Ruling <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              minLength={10}
              maxLength={3000}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Explain the administrative verdict and instructions for the client and builder..."
              className="w-full px-4 py-3 border-2 border-black rounded-xl text-xs font-medium focus:bg-[#ffe17c]/20 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || resolutionNote.length < 10}
              className="neo-btn px-6 py-3 bg-black hover:bg-black/90 text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black disabled:opacity-50 transition"
            >
              {loading ? "Adjudicating..." : "Resolve & Commit Verdict →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
