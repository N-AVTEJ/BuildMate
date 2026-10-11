"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConflictProject {
  id: string;
  projectCode: string;
  title: string;
  status: string;
}

interface BuilderProjectActionsProps {
  projectId: string;
  showReject?: boolean;
}

export function BuilderProjectActions({ projectId, showReject = true }: BuilderProjectActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictProject[] | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  async function handleAccept(confirmed = false) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept project.");
        setLoading(false);
        return;
      }

      // Check if duplicate project warning was returned
      if (data.warning && data.code === "SIMILAR_ACTIVE_PROJECT") {
        setConflicts(data.conflicts || []);
        setShowConfirmModal(true);
        setLoading(false);
        return;
      }

      // Successfully accepted!
      setShowConfirmModal(false);
      router.push(`/builder/projects/${projectId}`);
      router.refresh();
    } catch {
      setError("Network error while accepting project.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!confirm("Are you sure you want to reject this project? It will remain available for other builders.")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/reject`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reject project.");
        setLoading(false);
        return;
      }

      router.push("/builder");
      router.refresh();
    } catch {
      setError("Network error while rejecting project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {error && (
          <div className="p-3 text-xs font-bold text-black bg-rose-200 border-2 border-black rounded-xl neo-shadow-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleAccept(false)}
            disabled={loading}
            className="neo-btn px-5 py-2.5 bg-black hover:bg-black/90 text-[#ffe17c] text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Processing..." : "Acquire Project →"}
          </button>

          {showReject && (
            <button
              onClick={handleReject}
              disabled={loading}
              className="neo-btn px-4 py-2.5 bg-white hover:bg-rose-100 text-black text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Pass
            </button>
          )}
        </div>
      </div>

      {/* Duplicate Project Confirmation Modal */}
      {showConfirmModal && conflicts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs font-body text-[#171e19]">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 border-2 border-black neo-shadow-lg">
            <div className="w-14 h-14 rounded-xl bg-[#ffe17c] text-black border-2 border-black flex items-center justify-center mb-4 text-2xl neo-shadow-sm">
              ⚠️
            </div>

            <h3 className="text-xl font-heading font-black text-black mb-2">
              Similar Active Project Detected
            </h3>

            <p className="text-sm text-black/70 font-semibold mb-4">
              You already have active projects with similar scope or tech stack:
            </p>

            <ul className="mb-6 divide-y-2 divide-black/10 bg-[#fffdf0] p-3.5 rounded-xl border-2 border-black text-xs font-medium">
              {conflicts.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold bg-black text-[#ffe17c] px-1.5 py-0.5 rounded text-[10px] mr-1.5">
                      {c.projectCode}
                    </span>
                    <span className="font-bold text-black">{c.title}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase bg-white border border-black px-1.5 py-0.5 rounded">
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-rose-800 font-bold mb-6">
              Do you want to proceed anyway and acquire this project?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="neo-btn px-4 py-2.5 text-xs font-heading font-black uppercase text-black bg-white hover:bg-gray-100 rounded-xl border-2 border-black"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAccept(true)}
                disabled={loading}
                className="neo-btn px-5 py-2.5 text-xs font-heading font-black uppercase text-black bg-[#ffe17c] hover:bg-emerald-300 rounded-xl border-2 border-black"
              >
                {loading ? "Acquiring..." : "Proceed & Acquire"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
