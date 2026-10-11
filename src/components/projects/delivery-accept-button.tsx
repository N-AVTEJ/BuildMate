"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeliveryAcceptButtonProps {
  projectId: string;
}

export function DeliveryAcceptButton({ projectId }: DeliveryAcceptButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (
      !confirm(
        "Are you sure you want to accept this delivery? This will mark the project as COMPLETED."
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACCEPT" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept delivery.");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      {error && (
        <span className="text-xs font-bold text-rose-700 bg-rose-200 border border-black px-2 py-1 rounded">
          {error}
        </span>
      )}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="neo-btn px-5 py-2.5 bg-black hover:bg-emerald-600 text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black disabled:opacity-50"
      >
        {loading ? "Accepting..." : "Accept & Complete ✓"}
      </button>
    </div>
  );
}
