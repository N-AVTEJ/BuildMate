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
    <div>
      {error && (
        <span className="text-xs text-red-600 mr-2 block sm:inline">
          {error}
        </span>
      )}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
      >
        {loading ? "Accepting..." : "Accept & Complete"}
      </button>
    </div>
  );
}
