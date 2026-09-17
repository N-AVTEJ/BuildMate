"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeliverableData {
  id?: string;
  githubUrl?: string;
  repoType?: string;
  branch?: string;
  commitRef?: string;
  description?: string;
  implementedFeatures?: string;
  documentationUrl?: string | null;
  pptUrl?: string | null;
  demoUrl?: string | null;
  deploymentUrl?: string | null;
}

interface DeliverableSubmissionFormProps {
  projectId: string;
  projectStatus: string;
  initialDeliverable?: DeliverableData | null;
}

export function DeliverableSubmissionForm({
  projectId,
  projectStatus,
  initialDeliverable,
}: DeliverableSubmissionFormProps) {
  const router = useRouter();

  const isLocked =
    projectStatus === "DELIVERY_UNLOCKED" ||
    projectStatus === "CLIENT_REVIEW" ||
    projectStatus === "COMPLETED";

  const isPendingFinalPayment =
    projectStatus === "FINAL_PAYMENT_PENDING" ||
    projectStatus === "FINAL_PAYMENT_PROOF_SUBMITTED";

  const [formData, setFormData] = useState({
    githubUrl: initialDeliverable?.githubUrl || "",
    repoType: initialDeliverable?.repoType || "public",
    branch: initialDeliverable?.branch || "main",
    commitRef: initialDeliverable?.commitRef || "",
    description: initialDeliverable?.description || "",
    implementedFeatures: initialDeliverable?.implementedFeatures || "",
    documentationUrl: initialDeliverable?.documentationUrl || "",
    pptUrl: initialDeliverable?.pptUrl || "",
    demoUrl: initialDeliverable?.demoUrl || "",
    deploymentUrl: initialDeliverable?.deploymentUrl || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side quick check
    if (!formData.githubUrl.startsWith("https://github.com/")) {
      setError(
        "GitHub URL must start with https://github.com/ and include owner and repository."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit deliverables.");
      }

      setSuccess(
        data.updated
          ? "Deliverables updated successfully!"
          : "Deliverables submitted! The project is now pending final payment."
      );
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 border-b pb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Project Deliverables & Submission
          </h3>
          <p className="text-sm text-gray-500">
            Submit your source repository, commit reference, and deliverables for client review.
          </p>
        </div>
        {isLocked && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
            Deliverables Locked (Paid)
          </span>
        )}
        {isPendingFinalPayment && !isLocked && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Final Payment Pending (Editable)
          </span>
        )}
      </div>

      {isLocked ? (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 font-medium mb-2">
              Deliverables have been unlocked for the client. Editing is locked.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
              <div>
                <span className="font-semibold text-gray-800">Repository:</span>{" "}
                <span className="font-mono">{formData.githubUrl}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Branch / Commit:</span>{" "}
                <span className="font-mono">{formData.branch} @ {formData.commitRef}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                GitHub Repository URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://github.com/owner/repository"
                value={formData.githubUrl}
                onChange={(e) =>
                  setFormData({ ...formData, githubUrl: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                Must be an https:// URL pointing to github.com.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Repository Visibility <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.repoType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    repoType: e.target.value as "public" | "private",
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="public">Public Repository</option>
                <option value="private">Private Repository</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Target Branch <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="main"
                value={formData.branch}
                onChange={(e) =>
                  setFormData({ ...formData, branch: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Commit Reference / Tag <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 7f8c9b2 or v1.0.0"
                value={formData.commitRef}
                onChange={(e) =>
                  setFormData({ ...formData, commitRef: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Live Deployment URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://my-app.vercel.app"
                value={formData.deploymentUrl}
                onChange={(e) =>
                  setFormData({ ...formData, deploymentUrl: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Documentation URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={formData.documentationUrl}
                onChange={(e) =>
                  setFormData({ ...formData, documentationUrl: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Project Presentation (PPT) URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={formData.pptUrl}
                onChange={(e) =>
                  setFormData({ ...formData, pptUrl: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Implemented Features <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="List key features implemented against project requirements..."
                value={formData.implementedFeatures}
                onChange={(e) =>
                  setFormData({ ...formData, implementedFeatures: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Delivery Description / Instructions <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Provide instructions on running the application, credentials, environment notes, etc."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {loading
                ? "Submitting..."
                : isPendingFinalPayment
                ? "Update Deliverables"
                : "Submit for Delivery"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
