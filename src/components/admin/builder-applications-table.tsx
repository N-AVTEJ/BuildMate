"use client";

import { useState } from "react";

export interface BuilderApplicationItem {
  id: string;
  name: string;
  email: string;
  resumeUrl: string;
  githubUrl: string | null;
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export function BuilderApplicationsTable({
  initialApplications,
}: {
  initialApplications: BuilderApplicationItem[];
}) {
  const [applications, setApplications] = useState<BuilderApplicationItem[]>(initialApplications);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ id: string; text: string; type: "success" | "error" } | null>(null);

  const filteredApps = applications.filter((app) => {
    if (filter === "ALL") return true;
    return app.status === filter;
  });

  const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
    setLoadingId(id);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/builder-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action.toLowerCase()} application.`);
      }

      setApplications((prev) =>
        prev.map((app) =>
          app.id === id ? { ...app, status: action === "APPROVE" ? "APPROVED" : "REJECTED" } : app
        )
      );

      const targetApp = applications.find((a) => a.id === id);
      if (action === "APPROVE") {
        setStatusMessage({
          id,
          text: `Application for ${targetApp?.email} APPROVED! Notice sent. To provision their BUILDER role, run: npx tsx scripts/provision-builder.ts "${targetApp?.email}"`,
          type: "success",
        });
      } else {
        setStatusMessage({
          id,
          text: `Application for ${targetApp?.email} REJECTED. No account or role created.`,
          type: "success",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        id,
        text: err.message || "Action failed.",
        type: "error",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs & Manual Provisioning Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((tab) => {
            const count =
              tab === "ALL"
                ? applications.length
                : applications.filter((a) => a.status === tab).length;

            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`neo-btn px-3.5 py-1.5 text-xs font-heading font-black uppercase tracking-wider rounded-xl transition ${
                  filter === tab
                    ? "bg-black text-[#ffe17c] border-2 border-black"
                    : "bg-white text-black hover:bg-black/5 border-2 border-black"
                }`}
              >
                {tab.toLowerCase()} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono font-bold bg-[#ffe17c] border-2 border-black px-3 py-1.5 rounded-xl neo-shadow-sm flex items-center gap-2">
          <span>🔒 Vetting Policy:</span>
          <span>Zero Auto-Grants (Manual Provisioning Only)</span>
        </div>
      </div>

      {/* Global Status Message / Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border-2 border-black neo-shadow-sm text-xs font-bold ${
            statusMessage.type === "success"
              ? "bg-emerald-100 text-emerald-950 border-emerald-900"
              : "bg-rose-100 text-rose-950 border-rose-900"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Applications Table */}
      {filteredApps.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-black p-12 text-center neo-shadow-lg">
          <div className="w-16 h-16 rounded-2xl bg-[#ffe17c] border-2 border-black text-black flex items-center justify-center text-3xl mx-auto mb-4 neo-shadow-sm">
            📭
          </div>
          <h3 className="text-xl font-heading font-black text-black">
            No {filter !== "ALL" ? filter.toLowerCase() : ""} applications found
          </h3>
          <p className="mt-2 text-sm text-black/70 font-medium max-w-sm mx-auto leading-relaxed">
            New builder applications submitted via <span className="font-mono text-xs font-bold text-black bg-[#ffe17c] px-1 py-0.5 border border-black rounded">/builder/apply</span> will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-black neo-shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-black text-left text-sm">
              <thead className="bg-black text-[#ffe17c] text-xs font-heading font-black uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Applicant</th>
                  <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Email</th>
                  <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Resume / GitHub</th>
                  <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Status</th>
                  <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Background Note</th>
                  <th scope="col" className="px-6 py-4 border-r-2 border-black/20">Submitted</th>
                  <th scope="col" className="px-6 py-4 text-center">Review Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 bg-white">
                {filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-[#ffe17c]/10 transition-colors">
                    {/* Applicant Name */}
                    <td className="px-6 py-4 whitespace-nowrap font-heading font-black text-black border-r-2 border-black/10">
                      {app.name}
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 whitespace-nowrap border-r-2 border-black/10">
                      <a
                        href={`mailto:${app.email}`}
                        className="text-black font-mono font-bold text-xs underline decoration-2 hover:bg-[#ffe17c] px-1 py-0.5 rounded"
                      >
                        {app.email}
                      </a>
                    </td>

                    {/* Resume & GitHub */}
                    <td className="px-6 py-4 whitespace-nowrap border-r-2 border-black/10 space-y-1.5">
                      <div>
                        <a
                          href={`/api/admin/builder-applications/${app.id}/resume?redirect=true`}
                          target="_blank"
                          rel="noreferrer"
                          className="neo-btn inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-black bg-[#ffe17c] hover:bg-black hover:text-[#ffe17c] border border-black rounded-lg transition"
                        >
                          <span>📄</span>
                          <span>Download Resume</span>
                        </a>
                      </div>
                      {app.githubUrl && (
                        <div>
                          <a
                            href={app.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-mono text-black/80 hover:text-black hover:underline"
                          >
                            <span>🔗</span>
                            <span className="truncate max-w-[140px]">{app.githubUrl.replace(/^https?:\/\//, "")}</span>
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 whitespace-nowrap border-r-2 border-black/10">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-heading font-black uppercase tracking-wider border-2 border-black ${
                          app.status === "APPROVED"
                            ? "bg-emerald-200 text-emerald-950"
                            : app.status === "REJECTED"
                            ? "bg-rose-200 text-rose-950"
                            : "bg-[#ffe17c] text-black"
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>

                    {/* Message / Background */}
                    <td className="px-6 py-4 text-black font-medium max-w-xs break-words border-r-2 border-black/10">
                      {app.message ? (
                        <span className="text-xs whitespace-pre-wrap leading-relaxed line-clamp-3">
                          {app.message}
                        </span>
                      ) : (
                        <span className="text-xs text-black/40 italic">None provided</span>
                      )}
                    </td>

                    {/* Submitted Timestamp */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-black/70 font-mono font-bold border-r-2 border-black/10">
                      {new Date(app.createdAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {app.status === "PENDING" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={loadingId === app.id}
                            onClick={() => handleAction(app.id, "APPROVE")}
                            className="neo-btn px-3 py-1.5 bg-emerald-300 hover:bg-emerald-400 text-emerald-950 text-xs font-heading font-black uppercase tracking-wider rounded-lg border-2 border-black disabled:opacity-50"
                          >
                            {loadingId === app.id ? "..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={loadingId === app.id}
                            onClick={() => handleAction(app.id, "REJECT")}
                            className="neo-btn px-3 py-1.5 bg-rose-200 hover:bg-rose-300 text-rose-950 text-xs font-heading font-black uppercase tracking-wider rounded-lg border-2 border-black disabled:opacity-50"
                          >
                            {loadingId === app.id ? "..." : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-mono font-bold text-black/40">
                          Resolved ({app.status})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
