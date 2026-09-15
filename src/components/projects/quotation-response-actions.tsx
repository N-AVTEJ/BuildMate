"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuotationResponseActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!confirm("Are you sure you want to accept this quotation? This will lock the project scope to Version 1.")) {
      return;
    }
    setLoading("accept");
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/quotation/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept quotation.");
      }
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(null);
    }
  }

  async function handleReject() {
    if (!confirm("Are you sure you want to reject this quotation? The project will return to the builder for re-quotation.")) {
      return;
    }
    setLoading("reject");
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/quotation/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject quotation.");
      }
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={loading !== null}
          className="flex-1 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition shadow-sm"
        >
          {loading === "accept" ? "Accepting Quotation..." : "Accept Quotation & Lock Scope"}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={loading !== null}
          className="px-6 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-medium text-sm rounded-lg transition"
        >
          {loading === "reject" ? "Rejecting..." : "Reject Quotation"}
        </button>
      </div>
    </div>
  );
}
