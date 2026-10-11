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
        <div className="p-3.5 bg-rose-200 border-2 border-black rounded-xl text-xs font-bold text-black neo-shadow-sm">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={loading !== null}
          className="neo-btn flex-1 px-6 py-3 bg-[#ffe17c] hover:bg-emerald-300 text-black border-2 border-black font-heading font-black text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "accept" ? "Accepting Quotation..." : "Accept Quotation & Lock Scope ✓"}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={loading !== null}
          className="neo-btn px-6 py-3 bg-white hover:bg-rose-200 text-black border-2 border-black font-heading font-black text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "reject" ? "Rejecting..." : "Reject Quotation"}
        </button>
      </div>
    </div>
  );
}
