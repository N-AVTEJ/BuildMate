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
    phone?: string | null;
  };
  availableProjects: BuilderProjectCardItem[];
  myProjects: BuilderProjectCardItem[];
  notifications: BuilderNotificationItem[];
}

export function getBuilderNextAction(status: string, projectId: string) {
  switch (status) {
    case "ACCEPTED_PENDING_QUOTE":
      return {
        label: "Submit Quotation",
        actionText: "Submit Quotation →",
        href: `/builder/projects/${projectId}`,
        badgeClass: "bg-[#ffe17c] text-[#171e19] border-2 border-black font-black",
        icon: "📝",
        description: "Submit development duration and price quotation to client",
      };
    case "QUOTATION_SENT":
    case "AWAITING_ADVANCE":
    case "ADVANCE_PROOF_SUBMITTED":
    case "ADVANCE_VERIFICATION":
      return {
        label: "Waiting for Client Advance",
        actionText: "View Project →",
        href: `/builder/projects/${projectId}`,
        badgeClass: "bg-[#b7c6c2] text-[#171e19] border-2 border-black font-black",
        icon: "⏳",
        description: "Waiting for client advance payment deposit and verification",
      };
    case "ADVANCE_VERIFIED":
    case "IN_PROGRESS":
      return {
        label: "Continue Development",
        actionText: "Workspace & Submit →",
        href: `/builder/projects/${projectId}`,
        badgeClass: "bg-white text-[#171e19] border-2 border-black font-black",
        icon: "⚡",
        description: "Develop codebase according to scope and submit deliverable",
      };
    case "OVERDUE":
      return {
        label: "Update Progress",
        actionText: "Post Update / Submit →",
        href: `/builder/projects/${projectId}`,
        badgeClass: "bg-rose-200 text-rose-950 border-2 border-black font-black",
        icon: "⚠️",
        description: "Project overdue — update development progress or submit completed project",
      };
    case "SUBMITTED_FOR_DELIVERY":
    case "FINAL_PAYMENT_PENDING":
    case "FINAL_PAYMENT_PROOF_SUBMITTED":
    case "FINAL_PAYMENT_VERIFICATION":
      return {
        label: "Waiting for Client Final Payment",
        actionText: "View Delivery State →",
        href: `/builder/projects/${projectId}`,
        badgeClass: "bg-[#ffe17c] text-[#171e19] border-2 border-black font-black",
        icon: "💳",
        description: "Deliverables submitted. Awaiting client final payment verification.",
      };
    case "DELIVERY_UNLOCKED":
      return {
        label: "Delivery Unlocked",
        actionText: "View Delivered →",
        href: `/builder/projects/${projectId}`,
        badgeClass: "bg-emerald-200 text-emerald-950 border-2 border-black font-black",
        icon: "🎉",
        description: "Final payment verified! GitHub repository unlocked for client.",
      };
    case "COMPLETED":
      return {
        label: "Completed",
        actionText: "View Project →",
        href: `/builder/projects/${projectId}`,
        badgeClass: "bg-gray-200 text-[#171e19] border-2 border-black font-black",
        icon: "✓",
        description: "Project completed and archived",
      };
    default:
      return {
        label: "Manage Project",
        actionText: "Open →",
        href: `/builder/projects/${projectId}`,
        badgeClass: "bg-white text-[#171e19] border-2 border-black font-black",
        icon: "📁",
        description: "Open project workspace",
      };
  }
}

export function BuilderDashboardView({
  user,
  availableProjects,
  myProjects,
  notifications,
}: BuilderDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "available"
    | "my-projects"
    | "quotations"
    | "deadlines"
    | "progress"
    | "deliveries"
    | "payments"
    | "messages"
    | "notifications"
    | "profile"
    | "guidelines"
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
      <div className="bg-[#ffe17c] border-2 border-black p-6 sm:p-8 neo-shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm mb-3">
            ⚡ Verified Builder Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-cabinet font-black tracking-tight text-[#171e19]">
            Builder Command Center — {user.name || user.email}
          </h1>
          <p className="text-gray-800 font-medium text-sm mt-1 max-w-xl">
            Acquire newly submitted software projects, submit formal quotations, track development deadlines, and manage deliveries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab("available")}
            className="neo-btn inline-flex items-center px-5 py-3 bg-[#171e19] text-[#ffe17c] font-black text-sm uppercase tracking-wider border-2 border-black neo-shadow"
          >
            ⚡ Browse Available Projects ({countAvailable})
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b-2 border-black overflow-x-auto gap-2 pb-2">
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "available", label: `⚡ Available (${countAvailable})` },
          { id: "my-projects", label: `💼 My Projects (${myProjects.length})` },
          { id: "quotations", label: `📝 Quotations (${countAwaitingQuote})` },
          { id: "deadlines", label: "⏳ Deadlines" },
          { id: "progress", label: `📈 Progress (${countInDev + countOverdue})` },
          { id: "deliveries", label: `📦 Deliveries (${countAwaitingDelivery + countCompleted})` },
          { id: "payments", label: "💳 Payments" },
          { id: "messages", label: "💬 Messages" },
          { id: "notifications", label: `🔔 Notifications (${notifications.filter((n) => !n.read).length})` },
          { id: "profile", label: "👤 Profile" },
          { id: "guidelines", label: "📖 Guidelines" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider border-2 whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-[#171e19] text-[#ffe17c] border-black neo-shadow-sm"
                : "bg-white text-[#171e19] border-black hover:bg-[#ffe17c]"
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
            <div className="bg-white p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-gray-600 block">Available</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{countAvailable}</span>
            </div>
            <div className="bg-[#ffe17c] p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-[#171e19] block">Needs Quote</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{countAwaitingQuote}</span>
            </div>
            <div className="bg-[#b7c6c2] p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-[#171e19] block">Awaiting Advance</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{countAwaitingAdvance}</span>
            </div>
            <div className="bg-white p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-gray-600 block">In Dev</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{countInDev}</span>
            </div>
            <div className="bg-rose-100 p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-rose-900 block">Overdue</span>
              <span className="text-3xl font-cabinet font-black text-rose-700 mt-1 block">{countOverdue}</span>
            </div>
            <div className="bg-white p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-gray-600 block">Review/Delivery</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{countAwaitingDelivery}</span>
            </div>
            <div className="bg-emerald-100 p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-emerald-900 block">Completed</span>
              <span className="text-3xl font-cabinet font-black text-emerald-800 mt-1 block">{countCompleted}</span>
            </div>
          </div>

          {/* Attention Alerts */}
          {countAwaitingQuote > 0 && (
            <div className="p-5 bg-[#ffe17c] border-2 border-black neo-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="text-base font-cabinet font-black text-[#171e19] uppercase tracking-wide">Quotation Pending</h4>
                  <p className="text-xs font-bold text-gray-800 mt-0.5">
                    You have accepted {countAwaitingQuote} project(s) awaiting your formal development quotation and timeline.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab("my-projects");
                  setStatusFilter("AWAITING_QUOTE");
                }}
                className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm shrink-0"
              >
                Submit Quotation Now →
              </button>
            </div>
          )}

          {countOverdue > 0 && (
            <div className="p-5 bg-rose-200 border-2 border-black neo-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <h4 className="text-base font-cabinet font-black text-rose-950 uppercase tracking-wide">Overdue Development Alert</h4>
                  <p className="text-xs font-bold text-rose-900 mt-0.5">
                    {countOverdue} project(s) have passed their official development deadline. Please upload deliverables or post a progress update immediately.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab("deadlines");
                }}
                className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm shrink-0"
              >
                Inspect Overdue Projects →
              </button>
            </div>
          )}

          {/* Available Projects Preview */}
          <div className="bg-white border-2 border-black neo-shadow overflow-hidden">
            <div className="p-5 border-b-2 border-black flex items-center justify-between bg-[#fffdf0]">
              <div>
                <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Recently Available Projects</h3>
                <p className="text-xs font-bold text-gray-600">New projects submitted by verified clients awaiting discovery</p>
              </div>
              <button
                onClick={() => setActiveTab("available")}
                className="neo-btn px-3 py-1 bg-white text-[#171e19] hover:bg-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
              >
                Browse All ({countAvailable}) →
              </button>
            </div>

            {availableProjects.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm font-bold">
                There are currently no new projects awaiting builder discovery. Check back soon.
              </div>
            ) : (
              <div className="divide-y-2 divide-black">
                {availableProjects.slice(0, 3).map((p) => (
                  <div key={p.id} className="p-5 hover:bg-[#ffe17c]/20 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-[#171e19] bg-white border border-black px-1.5 py-0.5">{p.projectCode}</span>
                        <span className="px-2 py-0.5 text-[11px] font-black border border-black bg-emerald-200 text-emerald-950 uppercase">
                          AVAILABLE
                        </span>
                      </div>
                      <h4 className="text-lg font-cabinet font-black text-[#171e19]">
                        <Link href={`/builder/projects/${p.id}`} className="hover:underline">
                          {p.title}
                        </Link>
                      </h4>
                      <p className="text-xs font-medium text-gray-700 line-clamp-1">{p.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700 pt-1">
                        <span>Budget: <strong className="text-black">₹{p.budgetMin.toLocaleString()} - ₹{p.budgetMax.toLocaleString()}</strong></span>
                        <span>Tech: <strong className="text-black">{p.techStack}</strong></span>
                        <span>
                          Requested Completion:{" "}
                          <strong className="text-black">{p.requestedCompletionDate || "Flexible"}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      {p.acceptanceDeadline && (
                        <AcceptanceCountdown deadlineIso={p.acceptanceDeadline} />
                      )}
                      <Link
                        href={`/builder/projects/${p.id}`}
                        className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
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
          <div className="bg-white p-6 border-2 border-black neo-shadow flex items-center justify-between">
            <div>
              <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Available Projects for Discovery</h3>
              <p className="text-xs font-bold text-gray-600">Clients are actively searching for builders. Review specifications and accept to prepare your quotation.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-200 text-emerald-950 text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm">
              {countAvailable} Available
            </span>
          </div>

          {availableProjects.length === 0 ? (
            <div className="bg-white p-12 border-2 border-black neo-shadow text-center text-gray-700">
              <p className="text-lg font-cabinet font-black text-[#171e19] uppercase mb-1">No Available Projects</p>
              <p className="text-xs font-bold text-gray-600">All submitted projects have been acquired or expired. New submissions will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {availableProjects.map((p) => (
                <div key={p.id} className="bg-white p-6 border-2 border-black neo-shadow space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b-2 border-black pb-4">
                    <div>
                      <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                      <h4 className="text-xl font-cabinet font-black text-[#171e19] mt-2">
                        <Link href={`/builder/projects/${p.id}`} className="hover:underline">
                          {p.title}
                        </Link>
                      </h4>
                      <p className="text-xs font-bold text-gray-600 mt-0.5">{p.subject}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.acceptanceDeadline && (
                        <AcceptanceCountdown deadlineIso={p.acceptanceDeadline} />
                      )}
                      <Link
                        href={`/builder/projects/${p.id}`}
                        className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                      >
                        View &amp; Accept →
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#fffdf0] border-2 border-black p-3 text-xs">
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-600 block">Client Budget</span>
                      <span className="font-black text-[#171e19]">₹{p.budgetMin.toLocaleString()} - ₹{p.budgetMax.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-600 block">Tech Stack</span>
                      <span className="font-black text-[#171e19]">{p.techStack}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-600 block">Requested Completion</span>
                      <span className="font-black text-black">{p.requestedCompletionDate || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-600 block">Requirements Uploaded</span>
                      <span className="font-black text-[#171e19]">{p.requirementCount} attachment(s)</span>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-relaxed">
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
          <div className="bg-white p-4 border-2 border-black neo-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <input
              type="text"
              placeholder="Filter by title or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-xs border-2 border-black px-3 py-2 text-xs font-bold outline-none focus:bg-[#ffe17c]/20"
            />
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {["ALL", "AWAITING_QUOTE", "IN_PROGRESS", "OVERDUE", "COMPLETED"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition whitespace-nowrap ${
                    statusFilter === f ? "bg-[#171e19] text-[#ffe17c]" : "bg-white text-[#171e19] hover:bg-[#ffe17c]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredMyProjects.length === 0 ? (
              <div className="bg-white p-10 border-2 border-black neo-shadow text-center text-sm font-bold text-gray-600">
                No acquired projects match your filter.
              </div>
            ) : (
              filteredMyProjects.map((p) => {
                const nextAction = getBuilderNextAction(p.status, p.id);
                return (
                  <div key={p.id} className="bg-white p-5 border-2 border-black neo-shadow space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b-2 border-black pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                          <span className={`px-2 py-0.5 text-[11px] border border-black font-black uppercase ${
                            p.status === "ACCEPTED_PENDING_QUOTE"
                              ? "bg-[#ffe17c] text-[#171e19]"
                              : p.status === "IN_PROGRESS"
                              ? "bg-white text-[#171e19]"
                              : p.status === "OVERDUE"
                              ? "bg-rose-200 text-rose-950"
                              : p.status === "COMPLETED"
                              ? "bg-emerald-200 text-emerald-950"
                              : "bg-gray-200 text-[#171e19]"
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        <h4 className="text-lg font-cabinet font-black text-[#171e19] mt-2">
                          <Link href={`/builder/projects/${p.id}`} className="hover:underline">
                            {p.title}
                          </Link>
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/builder/projects/${p.id}`}
                          className="neo-btn px-3.5 py-1.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                        >
                          Manage Project →
                        </Link>
                        <Link
                          href={`/projects/${p.id}#messages`}
                          className="neo-btn px-3.5 py-1.5 bg-white hover:bg-[#ffe17c] text-[#171e19] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                        >
                          💬 Messages
                        </Link>
                      </div>
                    </div>

                    {/* Next Action Box */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#ffe17c] border-2 border-black neo-shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{nextAction.icon}</span>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#171e19] block">What to do next:</span>
                          <p className="text-xs font-black text-[#171e19]">
                            {nextAction.label} — <span className="font-bold text-gray-800">{nextAction.description}</span>
                          </p>
                        </div>
                      </div>
                      <Link
                        href={nextAction.href}
                        className="neo-btn px-3.5 py-1.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm shrink-0 inline-flex items-center gap-1"
                      >
                        {nextAction.actionText}
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-[#fffdf0] border-2 border-black p-3">
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Requested Completion</span>
                        <span className="font-black text-black">{p.requestedCompletionDate || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Official Dev Deadline</span>
                        <span className="font-black text-[#171e19]">
                          {p.developmentDeadline ? new Date(p.developmentDeadline).toLocaleDateString() : "Pending quote & advance"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Agreed Price</span>
                        <span className="font-black text-[#171e19]">
                          {p.totalPrice ? `₹${p.totalPrice.toLocaleString()}` : "Pending quote"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Last Progress Update</span>
                        <span className="font-black text-[#171e19]">
                          {p.lastProgressUpdateAt ? new Date(p.lastProgressUpdateAt).toLocaleDateString() : "No updates yet"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB: QUOTATIONS */}
      {activeTab === "quotations" && (
        <div className="space-y-4">
          <div className="bg-white p-6 border-2 border-black neo-shadow">
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Quotations Pending &amp; Review</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">
              Submit estimates or view client status for active quotations.
            </p>
          </div>

          {myProjects.filter((p) => ["ACCEPTED_PENDING_QUOTE", "QUOTATION_SENT"].includes(p.status)).length === 0 ? (
            <div className="bg-white p-10 border-2 border-black neo-shadow text-center text-sm font-bold text-gray-600">
              No quotations currently awaiting builder submission or client review.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myProjects
                .filter((p) => ["ACCEPTED_PENDING_QUOTE", "QUOTATION_SENT"].includes(p.status))
                .map((p) => {
                  const nextAction = getBuilderNextAction(p.status, p.id);
                  return (
                    <div key={p.id} className="bg-white p-5 border-2 border-black neo-shadow space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                          <h4 className="text-lg font-cabinet font-black text-[#171e19] mt-1">{p.title}</h4>
                        </div>
                        <span className={`px-2.5 py-0.5 text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm ${nextAction.badgeClass}`}>
                          {nextAction.label}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-700">{nextAction.description}</p>
                      <div className="flex justify-end pt-2">
                        <Link
                          href={nextAction.href}
                          className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                        >
                          {nextAction.actionText}
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB: PROGRESS */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          <div className="bg-white p-6 border-2 border-black neo-shadow">
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Active Development &amp; Progress Updates</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">
              Projects currently in development. Post regular progress updates and prepare final deliverables.
            </p>
          </div>

          {myProjects.filter((p) => ["ADVANCE_VERIFIED", "IN_PROGRESS", "OVERDUE"].includes(p.status)).length === 0 ? (
            <div className="bg-white p-10 border-2 border-black neo-shadow text-center text-sm font-bold text-gray-600">
              No projects currently in active development. Accept projects and await verified advance to start development.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myProjects
                .filter((p) => ["ADVANCE_VERIFIED", "IN_PROGRESS", "OVERDUE"].includes(p.status))
                .map((p) => (
                  <div key={p.id} className="bg-white p-5 border-2 border-black neo-shadow space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                        <h4 className="text-lg font-cabinet font-black text-[#171e19] mt-1">{p.title}</h4>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm ${
                          p.status === "OVERDUE" ? "bg-rose-200 text-rose-950" : "bg-white text-[#171e19]"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-[#fffdf0] border-2 border-black p-3">
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Official Dev Deadline</span>
                        <span className="font-black text-[#171e19]">
                          {p.developmentDeadline ? new Date(p.developmentDeadline).toLocaleDateString() : "Pending"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Last Progress Update</span>
                        <span className="font-black text-[#171e19]">
                          {p.lastProgressUpdateAt ? new Date(p.lastProgressUpdateAt).toLocaleDateString() : "None"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Agreed Price</span>
                        <span className="font-black text-emerald-800">₹{p.totalPrice?.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Link
                        href={`/builder/projects/${p.id}`}
                        className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                      >
                        Open Workspace &amp; Submit Deliverable →
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: DELIVERIES */}
      {activeTab === "deliveries" && (
        <div className="space-y-4">
          <div className="bg-white p-6 border-2 border-black neo-shadow">
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Project Deliverables &amp; Completed Submissions</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">
              Deliverables submitted for client final payment, review, or completed release.
            </p>
          </div>

          {myProjects.filter((p) =>
            [
              "SUBMITTED_FOR_DELIVERY",
              "FINAL_PAYMENT_PENDING",
              "FINAL_PAYMENT_PROOF_SUBMITTED",
              "FINAL_PAYMENT_VERIFICATION",
              "DELIVERY_UNLOCKED",
              "CLIENT_REVIEW",
              "COMPLETED",
            ].includes(p.status)
          ).length === 0 ? (
            <div className="bg-white p-10 border-2 border-black neo-shadow text-center text-sm font-bold text-gray-600">
              No projects have submitted deliverables yet. Complete development to submit your repositories.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myProjects
                .filter((p) =>
                  [
                    "SUBMITTED_FOR_DELIVERY",
                    "FINAL_PAYMENT_PENDING",
                    "FINAL_PAYMENT_PROOF_SUBMITTED",
                    "FINAL_PAYMENT_VERIFICATION",
                    "DELIVERY_UNLOCKED",
                    "CLIENT_REVIEW",
                    "COMPLETED",
                  ].includes(p.status)
                )
                .map((p) => {
                  const nextAction = getBuilderNextAction(p.status, p.id);
                  return (
                    <div key={p.id} className="bg-white p-5 border-2 border-black neo-shadow space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                          <h4 className="text-lg font-cabinet font-black text-[#171e19] mt-1">{p.title}</h4>
                        </div>
                        <span className={`px-2.5 py-0.5 text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm ${nextAction.badgeClass}`}>
                          {nextAction.label}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-700">{nextAction.description}</p>
                      <div className="flex justify-end pt-2">
                        <Link
                          href={`/builder/projects/${p.id}`}
                          className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                        >
                          View Deliverable Details →
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB: MESSAGES */}
      {activeTab === "messages" && (
        <div className="bg-white border-2 border-black neo-shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Client Communication &amp; Messages</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">Direct project discussions with your assigned clients</p>
          </div>

          {myProjects.length === 0 ? (
            <div className="p-8 text-center bg-[#fffdf0] border-2 border-dashed border-black">
              <span className="text-4xl block mb-2">💬</span>
              <h4 className="text-base font-cabinet font-black text-[#171e19] uppercase">No Active Client Conversations</h4>
              <p className="text-xs font-bold text-gray-600 max-w-sm mx-auto mt-1">
                Acquire an available project to open direct communication with the project client.
              </p>
            </div>
          ) : (
            <div className="divide-y-2 divide-black">
              {myProjects.map((p) => (
                <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                      <h4 className="text-base font-cabinet font-black text-[#171e19]">{p.title}</h4>
                    </div>
                    <p className="text-xs font-bold text-gray-700 mt-1">
                      Status: <span className="font-black text-black">{p.status}</span>
                    </p>
                  </div>
                  <Link
                    href={`/projects/${p.id}#messages`}
                    className="neo-btn px-4 py-2 bg-[#ffe17c] text-[#171e19] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm inline-flex items-center gap-1.5 shrink-0"
                  >
                    <span>💬</span> Open Discussion →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DEADLINES TRACKER */}
      {activeTab === "deadlines" && (
        <div className="space-y-4">
          <div className="bg-white p-6 border-2 border-black neo-shadow">
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Builder Deadlines &amp; Delivery Tracker</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">
              Live tracking powered by BuildMate deadline engine. Displays client requested completion dates, official system deadlines, and overdue states.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myProjects.map((p) => {
              const deadlineInfo = getDeadlineInfo(p.developmentDeadline);
              const isOverdue = p.status === "OVERDUE" || (deadlineInfo && deadlineInfo.isPast);

              return (
                <div key={p.id} className="bg-white p-5 border-2 border-black neo-shadow space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                      <h4 className="text-lg font-cabinet font-black text-[#171e19] mt-1">{p.title}</h4>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm ${
                        isOverdue ? "bg-rose-200 text-rose-950" : "bg-white text-[#171e19]"
                      }`}
                    >
                      {isOverdue ? "OVERDUE" : p.status}
                    </span>
                  </div>

                  <div className="divide-y-2 divide-black text-xs py-1 space-y-2 border-t-2 border-b-2 border-black bg-[#fffdf0] p-3">
                    <div className="flex justify-between pt-1">
                      <span className="text-gray-700 font-bold">Client Requested Completion:</span>
                      <span className="font-black text-black">{p.requestedCompletionDate || "Flexible"}</span>
                    </div>

                    <div className="flex justify-between pt-1">
                      <span className="text-gray-700 font-bold">Official Development Deadline:</span>
                      <span className="font-black text-[#171e19]">
                        {p.developmentDeadline ? new Date(p.developmentDeadline).toLocaleDateString() : "Pending advance"}
                      </span>
                    </div>

                    {deadlineInfo && (
                      <div className="flex justify-between pt-1">
                        <span className="text-gray-700 font-bold">Time Remaining:</span>
                        <span className={`font-black ${deadlineInfo.isPast ? "text-rose-700" : "text-emerald-800"}`}>
                          {deadlineInfo.isPast
                            ? `${Math.abs(deadlineInfo.diffDays)} days overdue`
                            : `${deadlineInfo.diffDays} day(s) remaining`}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between pt-1">
                      <span className="text-gray-700 font-bold">Last Progress Update:</span>
                      <span className="font-black text-[#171e19]">
                        {p.lastProgressUpdateAt ? new Date(p.lastProgressUpdateAt).toLocaleString() : "None submitted"}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Link
                      href={`/builder/projects/${p.id}`}
                      className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                    >
                      Manage Deadlines &amp; Deliverables →
                    </Link>
                  </div>
                </div>
              );
            })}

            {myProjects.length === 0 && (
              <div className="col-span-2 bg-white p-8 border-2 border-black neo-shadow text-center text-sm font-bold text-gray-600">
                You currently have no active project commitments to track. Browse available projects to acquire one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENTS & QR GUIDE */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="bg-white p-6 border-2 border-black neo-shadow">
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Builder Payment &amp; Escrow Instructions</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">
              Reference guide for platform escrow deposits, client advance schedules, and proof verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Escrow Rules */}
            <div className="bg-white p-6 border-2 border-black neo-shadow space-y-4">
              <h4 className="text-sm font-cabinet font-black text-[#171e19] uppercase tracking-wider">Platform Escrow Breakdown</h4>
              <div className="space-y-3 text-xs text-gray-800">
                <div className="p-3.5 bg-[#ffe17c] border-2 border-black neo-shadow-sm">
                  <p className="font-black text-[#171e19] mb-1 uppercase tracking-wide">1. 30% Required Advance Deposit</p>
                  <p className="font-medium text-gray-900">
                    Subject to a ₹300 minimum and total price cap. Client pays this deposit into platform escrow to start development.
                  </p>
                </div>
                <div className="p-3.5 bg-[#b7c6c2] border-2 border-black neo-shadow-sm">
                  <p className="font-black text-[#171e19] mb-1 uppercase tracking-wide">2. 70% Milestone Release</p>
                  <p className="font-medium text-gray-900">
                    Remaining balance is unlocked once the deliverable passes the 7-condition delivery security gate and client review.
                  </p>
                </div>
                <div className="p-3.5 bg-white border-2 border-black neo-shadow-sm">
                  <p className="font-black text-[#171e19] mb-1 uppercase tracking-wide">3. Server-Authoritative Verification</p>
                  <p className="font-medium text-gray-800">
                    Neither builder nor client can alter payment statuses. Verification is strictly performed by platform administrators reviewing transaction proofs.
                  </p>
                </div>
              </div>
            </div>

            {/* Official Payment QR Display */}
            <div className="bg-white p-6 border-2 border-black neo-shadow space-y-4 text-center">
              <span className="text-xs font-black uppercase tracking-wider text-[#171e19] bg-[#ffe17c] border border-black px-2 py-0.5 inline-block">
                Official Payment Channel
              </span>
              <h4 className="text-xl font-cabinet font-black text-[#171e19]">Platform UPI Escrow</h4>
              <p className="text-xs font-bold text-gray-600">Scan to make the required milestone deposit</p>

              <div className="flex justify-center p-4 bg-[#fffdf0] border-2 border-black neo-shadow-sm">
                <Image
                  src="/images/payment-qr.svg"
                  alt="BuildMate Payment QR"
                  width={180}
                  height={180}
                  className="border-2 border-black"
                  priority
                />
              </div>

              <div className="text-xs text-gray-800 space-y-1 text-left bg-[#ffe17c]/30 p-3.5 border-2 border-black">
                <p className="font-black text-[#171e19] uppercase tracking-wide">Instructions for Clients / Builders:</p>
                <p className="font-bold text-[#171e19]">1. Scan to make the required deposit.</p>
                <p className="font-bold text-[#171e19]">2. After payment, upload the transaction receipt.</p>
                <p className="text-[11px] font-bold text-gray-700 pt-1 italic">
                  * Note: The QR code is an instruction/display mechanism. Payment verification is strictly server and administrator controlled.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="bg-white border-2 border-black neo-shadow p-6 space-y-4">
          <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Builder Activity &amp; Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-sm font-bold text-gray-600 italic py-6 text-center">No notifications yet.</p>
          ) : (
            <div className="divide-y-2 divide-black">
              {notifications.map((n) => (
                <div key={n.id} className="py-3.5 flex items-start gap-3">
                  <span className={`w-3 h-3 border border-black mt-1.5 shrink-0 ${n.read ? "bg-gray-300" : "bg-[#ffe17c]"}`} />
                  <div className="flex-1">
                    <p className={`text-sm ${n.read ? "text-gray-700 font-medium" : "font-black text-[#171e19]"}`}>{n.message}</p>
                    <span className="text-xs font-bold text-gray-500">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: PROFILE */}
      {activeTab === "profile" && (
        <div className="bg-white border-2 border-black neo-shadow p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Builder Profile</h3>
            <p className="text-xs font-bold text-gray-600">Your vetted developer credentials and standing</p>
          </div>

          <div className="space-y-4 divide-y-2 divide-black text-sm">
            <div className="flex justify-between py-2">
              <span className="text-gray-700 font-bold">Full Name</span>
              <span className="font-black text-[#171e19]">{user.name || "Navtej"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-700 font-bold">Email Address</span>
              <span className="font-black text-[#171e19]">{user.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-700 font-bold">Phone Number</span>
              <span className="font-black text-[#171e19]">{user.phone || "Not set"}</span>
            </div>
            <div className="flex justify-between py-2 items-center">
              <span className="text-gray-700 font-bold">Account Role</span>
              <span className="inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-wider bg-[#ffe17c] text-[#171e19] border-2 border-black neo-shadow-sm">
                BUILDER (Vetted)
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-700 font-bold">Security</span>
              <span className="font-bold text-[#171e19]">Argon2id Hash Protected</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: GUIDELINES */}
      {activeTab === "guidelines" && (
        <div className="bg-white border-2 border-black neo-shadow p-6 space-y-4 max-w-3xl">
          <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Platform Development Guidelines &amp; SLAs</h3>
          <div className="space-y-3 text-xs text-gray-800 leading-relaxed">
            <div className="p-4 bg-[#fffdf0] border-2 border-black neo-shadow-sm">
              <h4 className="font-cabinet font-black text-[#171e19] uppercase text-sm mb-1">1. 48-Hour Acceptance Window</h4>
              <p className="font-medium">When a project is in AVAILABLE status, builders have 48 hours from client submission to review requirements and accept.</p>
            </div>
            <div className="p-4 bg-[#fffdf0] border-2 border-black neo-shadow-sm">
              <h4 className="font-cabinet font-black text-[#171e19] uppercase text-sm mb-1">2. Accurate Quotations</h4>
              <p className="font-medium">State fair timelines between 1 and 365 days. The 30% advance deposit is calculated automatically by the server.</p>
            </div>
            <div className="p-4 bg-[#fffdf0] border-2 border-black neo-shadow-sm">
              <h4 className="font-cabinet font-black text-[#171e19] uppercase text-sm mb-1">3. Bi-Weekly Progress Updates</h4>
              <p className="font-medium">Maintain consistent communication by submitting progress updates. Inactive projects risk entering OVERDUE status.</p>
            </div>
            <div className="p-4 bg-[#fffdf0] border-2 border-black neo-shadow-sm">
              <h4 className="font-cabinet font-black text-[#171e19] uppercase text-sm mb-1">4. 7-Condition Delivery Gate</h4>
              <p className="font-medium">Deliverables must pass cryptographic checksums, valid repo URLs, setup instructions, and clean audit states before client review unlock.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
