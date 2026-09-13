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
          <div className="p-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleAccept(false)}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Processing..." : "Accept Project"}
          </button>

          {showReject && (
            <button
              onClick={handleReject}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Reject
            </button>
          )}
        </div>
      </div>

      {/* Duplicate Project Confirmation Modal */}
      {showConfirmModal && conflicts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4 font-bold text-xl">
              ⚠️
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Similar Active Project Detected
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              You already have active projects with similar scope or tech stack:
            </p>

            <ul className="mb-6 divide-y divide-gray-100 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
              {conflicts.map((c) => (
                <li key={c.id} className="py-2">
                  <span className="font-mono font-bold text-blue-600">{c.projectCode}</span>:{" "}
                  <span className="font-medium text-gray-800">{c.title}</span>{" "}
                  <span className="text-gray-400">({c.status})</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-amber-700 font-semibold mb-6">
              Do you want to proceed anyway and acquire this project?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAccept(true)}
                disabled={loading}
                className="px-4 py-2 text-sm text-white bg-amber-600 hover:bg-amber-700 font-semibold rounded-lg shadow-sm transition"
              >
                {loading ? "Acquiring..." : "Proceed & Accept"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
