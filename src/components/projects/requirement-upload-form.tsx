"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RequirementUploadFormProps {
  projectId: string;
}

export function RequirementUploadForm({ projectId }: RequirementUploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to upload reference file.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setFile(null);
      // Refresh page to show newly uploaded requirement
      router.refresh();
    } catch {
      setError("Network error while uploading reference file.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#fffdf0] p-6 rounded-2xl border-2 border-black neo-shadow-sm mt-4 font-body text-[#171e19]">
      <h3 className="text-base font-heading font-black text-black mb-1">Upload Project Requirements</h3>
      <p className="text-xs text-black/70 font-semibold mb-4">
        Attach specifications, wireframes, or reference documents. Allowed formats: PNG, JPEG, PDF, ZIP, DOCX, PPTX (max 5 MB).
      </p>

      {error && (
        <div className="mb-4 p-3 text-xs font-bold text-black bg-rose-200 border-2 border-black rounded-xl neo-shadow-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 text-xs font-bold text-black bg-emerald-200 border-2 border-black rounded-xl neo-shadow-sm">
          Requirement file uploaded successfully!
        </div>
      )}

      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,.zip,.docx,.pptx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-xs text-black/70 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-heading file:font-black file:bg-[#ffe17c] file:text-black cursor-pointer"
        />
        <button
          type="submit"
          disabled={loading || !file}
          className="neo-btn px-5 py-2.5 bg-black hover:bg-[#ffe17c] hover:text-black text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "Uploading..." : "Upload Requirement"}
        </button>
      </form>
    </div>
  );
}
