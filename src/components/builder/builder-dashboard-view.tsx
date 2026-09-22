"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AcceptanceCountdown } from "@/components/projects/acceptance-countdown";

export interface BuilderProjectCardItem {
  id: string;
  projectCode: string;
  title: string;
  subject: string;
  description: string;
  techStack: string;
  budgetMin: number;
  budgetMax: number;
  totalPrice: number | null;
  advanceAmount: number | null;
  remainingAmount: number | null;
  status: string;
  requestedCompletionDate: string | null;
  developmentDeadline: string | null;
  advancePaymentDeadline: string | null;
  acceptanceDeadline: string | null;
  lastProgressUpdateAt: string | null;
  requirementCount: number;
  isAssignedToMe: boolean;
  submittedAt: string | null;
  createdAt: string;
}

export interface BuilderNotificationItem {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface BuilderDashboardViewProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  availableProjects: BuilderProjectCardItem[];
  myProjects: BuilderProjectCardItem[];
  notifications: BuilderNotificationItem[];
}

export function BuilderDashboardView({
  user,
  availableProjects,
  myProjects,
  notifications,
}: BuilderDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "available" | "my-projects" | "deadlines" | "payments" | "notifications" | "profile" | "guidelines"
  >("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const now = new Date();

  // Metrics
  const countAvailable = availableProjects.length;
  const countAwaitingQuote = myProjects.filter((p) => p.status === "ACCEPTED_PENDING_QUOTE").length;
  const countAwaitingAdvance = myProjects.filter((p) =>
    ["QUOTATION_SENT", "AWAITING_ADVANCE", "ADVANCE_PROOF_SUBMITTED", "ADVANCE_VERIFICATION"].includes(p.status)
  ).length;
  const countInDev = myProjects.filter((p) => ["ADVANCE_VERIFIED", "IN_PROGRESS"].includes(p.status)).length;
  const countOverdue = myProjects.filter((p) => p.status === "OVERDUE").length;
  const countAwaitingDelivery = myProjects.filter((p) =>
    ["SUBMITTED_FOR_DELIVERY", "CLIENT_REVIEW", "FINAL_PAYMENT_PENDING", "FINAL_PAYMENT_PROOF_SUBMITTED"].includes(p.status)
  ).length;
  const countCompleted = myProjects.filter((p) => p.status === "COMPLETED").length;

  // Filter My Projects
  const filteredMyProjects = myProjects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subject.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "ALL") return true;
    if (statusFilter === "AWAITING_QUOTE") return p.status === "ACCEPTED_PENDING_QUOTE";
    if (statusFilter === "IN_PROGRESS") return ["ADVANCE_VERIFIED", "IN_PROGRESS"].includes(p.status);
    if (statusFilter === "OVERDUE") return p.status === "OVERDUE";
    if (statusFilter === "COMPLETED") return p.status === "COMPLETED";
    return p.status === statusFilter;
  });

  const getDeadlineInfo = (deadlineStr: string | null) => {
    if (!deadlineStr) return null;
    const deadline = new Date(deadlineStr);
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isPast = diffMs < 0;

    return {
      dateFormatted: deadline.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
      diffDays,
      isPast,
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-slate-800">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 mb-2">
            Verified Builder Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Builder Portal — {user.name || user.email}
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Acquire newly submitted software projects, submit formal quotations, track development deadlines, and manage deliveries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab("available")}
            className="inline-flex items-center px-4 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl shadow hover:bg-blue-500 transition"
          >
            ⚡ Browse Available Projects ({countAvailable})
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto gap-1">
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "available", label: `⚡ Available Projects (${countAvailable})` },
          { id: "my-projects", label: `💼 My Projects (${myProjects.length})` },
          { id: "deadlines", label: "⏳ Deadlines Tracker" },
          { id: "payments", label: "💳 Payment & QR Guide" },
          { id: "notifications", label: `🔔 Notifications (${notifications.filter((n) => !n.read).length})` },
          { id: "profile", label: "👤 Profile" },
          { id: "guidelines", label: "📖 Guidelines" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-blue-600 block font-medium">Available</span>
              <span className="text-2xl font-bold text-gray-900 mt-1 block">{countAvailable}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-amber-600 block font-medium">Needs Quote</span>
              <span className="text-2xl font-bold text-amber-700 mt-1 block">{countAwaitingQuote}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-purple-600 block font-medium">Awaiting Advance</span>
              <span className="text-2xl font-bold text-purple-700 mt-1 block">{countAwaitingAdvance}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-indigo-600 block font-medium">In Development</span>
              <span className="text-2xl font-bold text-indigo-700 mt-1 block">{countInDev}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-red-600 block font-medium">Overdue</span>
              <span className="text-2xl font-bold text-red-700 mt-1 block">{countOverdue}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-teal-600 block font-medium">Review/Delivery</span>
              <span className="text-2xl font-bold text-teal-700 mt-1 block">{countAwaitingDelivery}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-emerald-600 block font-medium">Completed</span>
              <span className="text-2xl font-bold text-emerald-700 mt-1 block">{countCompleted}</span>
            </div>
          </div>

          {/* Attention Alerts */}
          {countAwaitingQuote > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Quotation Pending</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    You have accepted {countAwaitingQuote} project(s) awaiting your formal development quotation and timeline.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab("my-projects");
                  setStatusFilter("AWAITING_QUOTE");
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition shrink-0"
              >
                Submit Quotation Now →
              </button>
            </div>
          )}

          {countOverdue > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">🚨</span>
                <div>
                  <h4 className="text-sm font-bold text-red-900">Overdue Development Alert</h4>
                  <p className="text-xs text-red-700 mt-0.5">
                    {countOverdue} project(s) have passed their official development deadline. Please upload deliverables or post a progress update immediately.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab("deadlines");
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition shrink-0"
              >
                Inspect Overdue Projects →
              </button>
            </div>
          )}

          {/* Available Projects Preview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Recently Available Projects</h3>
                <p className="text-xs text-gray-500">New projects submitted by verified clients awaiting discovery</p>
              </div>
              <button
                onClick={() => setActiveTab("available")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Browse All ({countAvailable}) →
              </button>
            </div>

            {availableProjects.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                There are currently no new projects awaiting builder discovery. Check back soon.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {availableProjects.slice(0, 3).map((p) => (
                  <div key={p.id} className="p-5 hover:bg-gray-50/60 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-600">{p.projectCode}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          AVAILABLE
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900">
                        <Link href={`/builder/projects/${p.id}`} className="hover:text-blue-600 transition">
                          {p.title}
                        </Link>
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-1">{p.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 pt-1">
                        <span>Budget: <strong>₹{p.budgetMin.toLocaleString()} - ₹{p.budgetMax.toLocaleString()}</strong></span>
                        <span>Tech: <strong>{p.techStack}</strong></span>
                        <span>
                          Requested Completion:{" "}
                          <strong className="text-blue-700">{p.requestedCompletionDate || "Flexible"}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      {p.acceptanceDeadline && (
                        <AcceptanceCountdown deadlineIso={p.acceptanceDeadline} />
                      )}
                      <Link
                        href={`/builder/projects/${p.id}`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                      >
                        Inspect &amp; Accept →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AVAILABLE PROJECTS */}
      {activeTab === "available" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Available Projects for Discovery</h3>
              <p className="text-xs text-gray-500">Clients are actively searching for builders. Review specifications and accept to prepare your quotation.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
              {countAvailable} Available
            </span>
          </div>

          {availableProjects.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-500">
              <p className="text-base font-semibold text-gray-800 mb-1">No Available Projects</p>
              <p className="text-xs text-gray-500">All submitted projects have been acquired or expired. New submissions will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {availableProjects.map((p) => (
                <div key={p.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600">{p.projectCode}</span>
                      <h4 className="text-xl font-bold text-gray-900 mt-1">
                        <Link href={`/builder/projects/${p.id}`} className="hover:text-blue-600 transition">
                          {p.title}
                        </Link>
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">{p.subject}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.acceptanceDeadline && (
                        <AcceptanceCountdown deadlineIso={p.acceptanceDeadline} />
                      )}
                      <Link
                        href={`/builder/projects/${p.id}`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                      >
                        View &amp; Accept →
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
                    <div>
                      <span className="text-gray-500 block">Client Budget</span>
                      <span className="font-bold text-gray-900">₹{p.budgetMin.toLocaleString()} - ₹{p.budgetMax.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Tech Stack</span>
                      <span className="font-bold text-gray-900">{p.techStack}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Requested Completion</span>
                      <span className="font-bold text-blue-700">{p.requestedCompletionDate || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Requirements Uploaded</span>
                      <span className="font-bold text-gray-900">{p.requirementCount} attachment(s)</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY PROJECTS */}
      {activeTab === "my-projects" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <input
              type="text"
              placeholder="Filter by title or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {["ALL", "AWAITING_QUOTE", "IN_PROGRESS", "OVERDUE", "COMPLETED"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                    statusFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredMyProjects.length === 0 ? (
              <div className="bg-white p-10 rounded-xl border border-gray-200 text-center text-sm text-gray-500">
                No acquired projects match your filter.
              </div>
            ) : (
              filteredMyProjects.map((p) => (
                <div key={p.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-gray-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-600">{p.projectCode}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            p.status === "ACCEPTED_PENDING_QUOTE"
                              ? "bg-amber-100 text-amber-800"
                              : p.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800"
                              : p.status === "OVERDUE"
                              ? "bg-red-100 text-red-800"
                              : p.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mt-1">
                        <Link href={`/builder/projects/${p.id}`} className="hover:text-blue-600 transition">
                          {p.title}
                        </Link>
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/builder/projects/${p.id}`}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                      >
                        Manage Project →
                      </Link>
                      <Link
                        href={`/projects/${p.id}/messages`}
                        className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition"
                      >
                        💬 Messages
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-gray-50/70 p-3 rounded-lg">
                    <div>
                      <span className="text-gray-500 block">Requested Completion</span>
                      <span className="font-semibold text-blue-700">{p.requestedCompletionDate || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Official Dev Deadline</span>
                      <span className="font-semibold text-gray-900">
                        {p.developmentDeadline ? new Date(p.developmentDeadline).toLocaleDateString() : "Pending quote & advance"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Agreed Price</span>
                      <span className="font-semibold text-gray-900">
                        {p.totalPrice ? `₹${p.totalPrice.toLocaleString()}` : "Pending quote"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Last Progress Update</span>
                      <span className="font-semibold text-gray-900">
                        {p.lastProgressUpdateAt ? new Date(p.lastProgressUpdateAt).toLocaleDateString() : "No updates yet"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DEADLINES TRACKER */}
      {activeTab === "deadlines" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-base font-bold text-gray-900">Builder Deadlines & Delivery Tracker</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Live tracking powered by BuildMate deadline engine. Displays client requested completion dates, official system deadlines, and overdue states.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myProjects.map((p) => {
              const deadlineInfo = getDeadlineInfo(p.developmentDeadline);
              const isOverdue = p.status === "OVERDUE" || (deadlineInfo && deadlineInfo.isPast);

              return (
                <div key={p.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600">{p.projectCode}</span>
                      <h4 className="text-base font-bold text-gray-900">{p.title}</h4>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isOverdue ? "bg-red-100 text-red-800 border border-red-200" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {isOverdue ? "OVERDUE" : p.status}
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100 text-xs py-1 space-y-2 border-t border-b border-gray-100">
                    <div className="flex justify-between pt-1">
                      <span className="text-gray-500">Client Requested Completion:</span>
                      <span className="font-semibold text-blue-700">{p.requestedCompletionDate || "Flexible"}</span>
                    </div>

                    <div className="flex justify-between pt-1">
                      <span className="text-gray-500">Official Development Deadline:</span>
                      <span className="font-bold text-gray-900">
                        {p.developmentDeadline ? new Date(p.developmentDeadline).toLocaleDateString() : "Pending advance"}
                      </span>
                    </div>

                    {deadlineInfo && (
                      <div className="flex justify-between pt-1">
                        <span className="text-gray-500">Time Remaining:</span>
                        <span className={`font-bold ${deadlineInfo.isPast ? "text-red-600" : "text-emerald-700"}`}>
                          {deadlineInfo.isPast
                            ? `${Math.abs(deadlineInfo.diffDays)} days overdue`
                            : `${deadlineInfo.diffDays} day(s) remaining`}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between pt-1">
                      <span className="text-gray-500">Last Progress Update:</span>
                      <span className="font-medium text-gray-700">
                        {p.lastProgressUpdateAt ? new Date(p.lastProgressUpdateAt).toLocaleString() : "None submitted"}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Link
                      href={`/builder/projects/${p.id}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Manage Deadlines &amp; Deliverables →
                    </Link>
                  </div>
                </div>
              );
            })}

            {myProjects.length === 0 && (
              <div className="col-span-2 bg-white p-8 rounded-xl border border-gray-200 text-center text-sm text-gray-500">
                You currently have no active project commitments to track. Browse available projects to acquire one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENTS & QR GUIDE */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-base font-bold text-gray-900">Builder Payment & Escrow Instructions</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Reference guide for platform escrow deposits, client advance schedules, and proof verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Escrow Rules */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Platform Escrow Breakdown</h4>
              <div className="space-y-3 text-xs text-gray-600">
                <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-100">
                  <p className="font-bold text-blue-950 mb-1">1. 30% Required Advance Deposit</p>
                  <p className="text-blue-800">
                    Subject to a ₹300 minimum and total price cap. Client pays this deposit into platform escrow to start development.
                  </p>
                </div>
                <div className="p-3 bg-purple-50/70 rounded-lg border border-purple-100">
                  <p className="font-bold text-purple-950 mb-1">2. 70% Milestone Release</p>
                  <p className="text-purple-800">
                    Remaining balance is unlocked once the deliverable passes the 7-condition delivery security gate and client review.
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-bold text-gray-900 mb-1">3. Server-Authoritative Verification</p>
                  <p className="text-gray-600">
                    Neither builder nor client can alter payment statuses. Verification is strictly performed by platform administrators reviewing transaction proofs.
                  </p>
                </div>
              </div>
            </div>

            {/* Official Payment QR Display */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Official Payment Channel</span>
              <h4 className="text-base font-bold text-gray-900">Payment QR</h4>
              <p className="text-xs text-gray-500">Scan to make the required payment</p>

              <div className="flex justify-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                <Image
                  src="/images/payment-qr.svg"
                  alt="BuildMate Payment QR"
                  width={180}
                  height={180}
                  className="rounded-lg shadow-sm"
                  priority
                />
              </div>

              <div className="text-xs text-gray-600 space-y-1 text-left bg-blue-50/60 p-3.5 rounded-lg border border-blue-100">
                <p className="font-bold text-blue-950">Instructions for Clients / Builders:</p>
                <p className="text-blue-900">1. Scan to make the required payment.</p>
                <p className="text-blue-900">2. After payment, upload the payment proof.</p>
                <p className="text-[11px] text-blue-700 pt-1 italic">
                  * Note: The QR code is an instruction/display mechanism. Payment verification is strictly server and administrator controlled.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900">Builder Activity &amp; Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-6 text-center">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <div key={n.id} className="py-3 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-gray-300" : "bg-blue-600"}`} />
                  <div className="flex-1">
                    <p className={`text-sm ${n.read ? "text-gray-700" : "font-semibold text-gray-900"}`}>{n.message}</p>
                    <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: PROFILE */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-gray-900">Builder Profile</h3>
            <p className="text-xs text-gray-500">Your vetted developer credentials and standing</p>
          </div>

          <div className="space-y-4 divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Full Name</span>
              <span className="font-semibold text-gray-900">{user.name || "Navtej"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Email Address</span>
              <span className="font-semibold text-gray-900">{user.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Account Role</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                BUILDER (Vetted)
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Security</span>
              <span className="font-medium text-gray-700">Argon2id Hash Protected</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: GUIDELINES */}
      {activeTab === "guidelines" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 max-w-3xl">
          <h3 className="text-base font-bold text-gray-900">Platform Development Guidelines &amp; SLAs</h3>
          <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">1. 48-Hour Acceptance Window</h4>
              <p>When a project is in AVAILABLE status, builders have 48 hours from client submission to review requirements and accept.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">2. Accurate Quotations</h4>
              <p>State fair timelines between 1 and 365 days. The 30% advance deposit is calculated automatically by the server.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">3. Bi-Weekly Progress Updates</h4>
              <p>Maintain consistent communication by submitting progress updates. Inactive projects risk entering OVERDUE status.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">4. 7-Condition Delivery Gate</h4>
              <p>Deliverables must pass cryptographic checksums, valid repo URLs, setup instructions, and clean audit states before client review unlock.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
