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
    <div className="bg-white rounded-2xl border-2 border-black p-6 sm:p-8 neo-shadow-md font-body text-[#171e19]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b-2 border-black/10 pb-4">
        <div>
          <span className="font-heading font-black text-xs uppercase tracking-wider px-2.5 py-1 bg-[#ffe17c] text-black border border-black rounded inline-block mb-2">
            Project Deliverables
          </span>
          <h3 className="text-xl sm:text-2xl font-heading font-black text-black tracking-tight">
            Submit Source Code Deliverables
          </h3>
          <p className="text-xs text-black/70 font-semibold mt-1">
            Submit your source repository URL and delivery documentation for client verification and final escrow release.
          </p>
        </div>
        <div>
          {isLocked && (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-emerald-200 text-black border-2 border-black neo-shadow-sm">
              Deliverables Locked (Delivered)
            </span>
          )}
          {isPendingFinalPayment && !isLocked && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-[#ffe17c] text-black border-2 border-black neo-shadow-sm">
                Submitted ✓
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-amber-200 text-black border-2 border-black neo-shadow-sm">
                Final Payment Pending
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Before submitting notice */}
      {!isLocked && (
        <div className="mb-6 p-4 bg-[#ffe17c] border-2 border-black rounded-xl neo-shadow-sm">
          <h4 className="text-xs font-heading font-black text-black uppercase tracking-wider mb-1">
            Before submitting:
          </h4>
          <p className="text-xs text-black/80 font-medium">
            Make sure your repository contains the complete project source code, accurate commit hash, and setup notes.
          </p>
        </div>
      )}

      {isLocked ? (
        <div className="space-y-4">
          <div className="bg-[#fffdf0] border-2 border-black rounded-xl p-5 neo-shadow-sm">
            <p className="text-sm text-black font-heading font-black mb-3">
              Deliverables have been unlocked for the client. Editing is locked.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
              <div className="bg-white p-3 rounded-lg border border-black/20">
                <span className="font-heading font-black text-black block mb-0.5">Repository:</span>{" "}
                <span className="font-mono text-black font-bold break-all">{formData.githubUrl}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-black/20">
                <span className="font-heading font-black text-black block mb-0.5">Branch / Commit:</span>{" "}
                <span className="font-mono text-black font-bold">{formData.branch} @ {formData.commitRef}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                GitHub Repository URL <span className="text-rose-600">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://github.com/owner/repository"
                value={formData.githubUrl}
                onChange={(e) =>
                  setFormData({ ...formData, githubUrl: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-mono font-bold focus:bg-[#ffe17c]/20 focus:outline-none"
              />
              <p className="text-xs text-black/50 font-semibold mt-1">
                Must be an https:// URL pointing to github.com.
              </p>
            </div>

            <div>
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                Repository Visibility <span className="text-rose-600">*</span>
              </label>
              <select
                value={formData.repoType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    repoType: e.target.value as "public" | "private",
                  })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-bold bg-white focus:bg-[#ffe17c]/20 focus:outline-none"
              >
                <option value="public">Public Repository</option>
                <option value="private">Private Repository</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                Target Branch <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="main"
                value={formData.branch}
                onChange={(e) =>
                  setFormData({ ...formData, branch: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-mono font-bold focus:bg-[#ffe17c]/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                Commit Reference / Tag <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 7f8c9b2 or v1.0.0"
                value={formData.commitRef}
                onChange={(e) =>
                  setFormData({ ...formData, commitRef: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-mono font-bold focus:bg-[#ffe17c]/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                Live Deployment URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://my-app.vercel.app"
                value={formData.deploymentUrl}
                onChange={(e) =>
                  setFormData({ ...formData, deploymentUrl: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-mono font-bold focus:bg-[#ffe17c]/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                Documentation URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={formData.documentationUrl}
                onChange={(e) =>
                  setFormData({ ...formData, documentationUrl: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-mono font-bold focus:bg-[#ffe17c]/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                Project Presentation (PPT) URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={formData.pptUrl}
                onChange={(e) =>
                  setFormData({ ...formData, pptUrl: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-mono font-bold focus:bg-[#ffe17c]/20 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                Implemented Features <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="List key features implemented against project requirements..."
                value={formData.implementedFeatures}
                onChange={(e) =>
                  setFormData({ ...formData, implementedFeatures: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:bg-[#ffe17c]/20 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
                Delivery Description / Instructions <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Provide instructions on running the application, credentials, environment notes, etc."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:bg-[#ffe17c]/20 focus:outline-none leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t-2 border-black/10">
            <button
              type="submit"
              disabled={loading}
              className="neo-btn px-6 py-3 bg-black hover:bg-black/90 text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black disabled:opacity-50"
            >
              {loading
                ? "Submitting..."
                : isPendingFinalPayment
                ? "Update Deliverables →"
                : "Submit Deliverables →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
