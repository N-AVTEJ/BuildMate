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
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Project Requirements</h3>
      <p className="text-sm text-gray-500 mb-4">
        Attach specifications, wireframes, or reference documents. Allowed formats: PNG, JPEG, PDF, ZIP, DOCX, PPTX (max 5 MB).
      </p>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">
          Requirement file uploaded successfully!
        </div>
      )}

      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,.zip,.docx,.pptx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          type="submit"
          disabled={loading || !file}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "Uploading..." : "Upload Requirement"}
        </button>
      </form>
    </div>
  );
}
