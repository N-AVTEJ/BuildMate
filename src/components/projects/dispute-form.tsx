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
      <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <span className="text-2xl">⚠️</span>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Active Dispute in Progress</h2>
            <p className="text-xs text-gray-500">
              This project is currently under administrative dispute review.
            </p>
          </div>
        </div>

        <div className="bg-red-50/60 border border-red-100 rounded-lg p-4 mb-6 space-y-3">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Reason
            </span>
            <span className="text-sm font-bold text-gray-900">
              {activeDispute.reason.replace(/_/g, " ")}
            </span>
          </div>

          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Description
            </span>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mt-1">
              {activeDispute.description}
            </p>
          </div>

          <div className="text-xs text-gray-500 pt-1 border-t border-red-100">
            Opened on {new Date(activeDispute.createdAt).toLocaleDateString()} at{" "}
            {new Date(activeDispute.createdAt).toLocaleTimeString()}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg mb-4">
            {success}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {isRaiser ? (
            <button
              onClick={handleCancelDispute}
              disabled={loading}
              className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 text-sm font-semibold rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Withdrawing..." : "Withdraw / Cancel Dispute"}
            </button>
          ) : (
            <p className="text-xs text-gray-500 italic">
              Dispute was opened by the other party. BuildMate administration has been notified for mediation.
            </p>
          )}

          <a
            href={`/projects/${projectId}/messages`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
          >
            Open Project Chat
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          {success}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Dispute Reason <span className="text-red-500">*</span>
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {allowedReasons.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Select the category that best describes the issue.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
          Detailed Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          maxLength={3000}
          rows={5}
          placeholder="Describe the issue in detail, referencing specific scope items, missing features, or broken functionality..."
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Minimum 10 characters</span>
          <span>{description.length}/3000</span>
        </div>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
        <span className="font-bold">Important Note:</span> Opening a formal dispute locks active project delivery, halts automatic transitions, and invites BuildMate administration to mediate the dispute.
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t">
        <button
          type="submit"
          disabled={loading || description.length < 10}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
        >
          {loading ? "Submitting Dispute..." : "Submit Formal Dispute"}
        </button>
      </div>
    </form>
  );
}
