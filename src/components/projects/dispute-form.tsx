"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CLIENT_DISPUTE_REASONS,
  BUILDER_DISPUTE_REASONS,
} from "@/lib/projects/dispute-validation";

interface DisputeFormProps {
  projectId: string;
  role: "CLIENT" | "BUILDER";
  activeDispute?: {
    id: string;
    reason: string;
    description: string;
    raisedBy: string;
    createdAt: string | Date;
  } | null;
  currentUserId: string;
}

export function DisputeForm({
  projectId,
  role,
  activeDispute,
  currentUserId,
}: DisputeFormProps) {
  const router = useRouter();
  const allowedReasons =
    role === "CLIENT" ? CLIENT_DISPUTE_REASONS : BUILDER_DISPUTE_REASONS;

  const [reason, setReason] = useState<string>(allowedReasons[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isRaiser = activeDispute?.raisedBy === currentUserId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/disputes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to open dispute.");
      }

      setSuccess("Dispute opened successfully. The project has been placed in DISPUTE_OPEN status.");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDispute = async () => {
    if (!confirm("Are you sure you want to withdraw this dispute? The project will be restored to its pre-dispute status.")) {
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/disputes/cancel`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to withdraw dispute.");
      }

      setSuccess("Dispute withdrawn successfully. The project status has been restored.");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // If an active dispute already exists
  if (activeDispute) {
    return (
      <div className="bg-rose-100 rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-lg font-body text-[#171e19]">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">⚠️</span>
          <div>
            <h2 className="text-xl font-heading font-black text-black">Active Dispute in Progress</h2>
            <p className="text-xs font-semibold text-black/70 mt-0.5">
              This project is currently under administrative dispute mediation.
            </p>
          </div>
        </div>

        <div className="bg-white border-2 border-black rounded-xl p-5 mb-6 space-y-4 neo-shadow-sm">
          <div>
            <span className="text-[11px] font-heading font-black uppercase tracking-wider text-black/60 block">
              Reason
            </span>
            <span className="text-base font-heading font-black text-black">
              {activeDispute.reason.replace(/_/g, " ")}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-heading font-black uppercase tracking-wider text-black/60 block">
              Description
            </span>
            <p className="text-sm font-medium text-black/90 whitespace-pre-wrap leading-relaxed mt-1 bg-[#fffdf0] p-3 rounded-lg border border-black/20">
              {activeDispute.description}
            </p>
          </div>

          <div className="text-xs font-mono font-bold text-black/60 pt-2 border-t border-black/10">
            Opened on {new Date(activeDispute.createdAt).toLocaleDateString()} at{" "}
            {new Date(activeDispute.createdAt).toLocaleTimeString()}
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-200 border-2 border-black text-black text-xs font-bold rounded-xl mb-4 neo-shadow-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-200 border-2 border-black text-black text-xs font-bold rounded-xl mb-4 neo-shadow-sm">
            {success}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          {isRaiser ? (
            <button
              onClick={handleCancelDispute}
              disabled={loading}
              className="neo-btn px-4 py-2.5 border-2 border-black bg-white hover:bg-rose-200 text-black text-xs font-heading font-black uppercase tracking-wider rounded-xl transition disabled:opacity-50"
            >
              {loading ? "Withdrawing..." : "Withdraw / Cancel Dispute"}
            </button>
          ) : (
            <p className="text-xs text-black/70 font-semibold italic">
              Dispute was opened by the other party. BuildMate administration has been notified for mediation.
            </p>
          )}

          <a
            href={`/projects/${projectId}/messages`}
            className="neo-btn px-5 py-2.5 bg-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl"
          >
            Open Project Chat →
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-md space-y-5 font-body text-[#171e19]">
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

      <div>
        <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
          Dispute Reason <span className="text-rose-600">*</span>
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-sm font-semibold focus:bg-[#ffe17c]/20 bg-white"
        >
          {allowedReasons.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="text-xs text-black/60 font-semibold mt-1">
          Select the category that best describes the issue.
        </p>
      </div>

      <div>
        <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
          Detailed Description <span className="text-rose-600">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          maxLength={3000}
          rows={5}
          placeholder="Describe the issue in detail, referencing specific scope items, missing features, or broken functionality..."
          className="w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-sm font-medium focus:bg-[#ffe17c]/20 leading-relaxed"
        />
        <div className="flex justify-between text-xs font-bold text-black/50 mt-1">
          <span>Minimum 10 characters</span>
          <span>{description.length}/3000</span>
        </div>
      </div>

      <div className="p-4 bg-[#ffe17c] border-2 border-black rounded-xl text-xs font-semibold text-black leading-relaxed">
        <span className="font-heading font-black uppercase">Important Note:</span> Opening a formal dispute locks active project delivery, halts automatic transitions, and invites BuildMate administration to mediate the dispute.
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t-2 border-black/10">
        <button
          type="submit"
          disabled={loading || description.length < 10}
          className="neo-btn px-6 py-3 bg-black text-white hover:bg-rose-600 text-xs font-heading font-black uppercase tracking-wider rounded-xl disabled:opacity-50"
        >
          {loading ? "Submitting Dispute..." : "Submit Formal Dispute"}
        </button>
      </div>
    </form>
  );
}
