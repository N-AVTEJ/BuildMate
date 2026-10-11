"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export interface ClientProjectItem {
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
  builderAcceptedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  builder: {
    id: string;
    name: string;
    email: string;
  } | null;
  payment: {
    id: string;
    type: string;
    expectedAmount: number;
    submittedAmount: number | null;
    status: string;
    transactionReference: string | null;
  } | null;
}

export interface ClientNotificationItem {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface ClientDashboardViewProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
  };
  projects: ClientProjectItem[];
  notifications: ClientNotificationItem[];
}

export function ClientDashboardView({ user, projects, notifications }: ClientDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "deadlines" | "payments" | "messages" | "notifications" | "profile">("overview");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Categorize projects for Overview metrics
  const totalProjects = projects.length;
  const awaitingBuilder = projects.filter((p) => p.status === "AVAILABLE" || p.status === "SUBMITTED").length;
  const awaitingQuote = projects.filter((p) => p.status === "ACCEPTED_PENDING_QUOTE" || p.status === "QUOTATION_SENT").length;
  const awaitingPayment = projects.filter((p) =>
    ["AWAITING_ADVANCE", "ADVANCE_PROOF_SUBMITTED", "ADVANCE_VERIFICATION", "FINAL_PAYMENT_PENDING", "FINAL_PAYMENT_PROOF_SUBMITTED"].includes(p.status)
  ).length;
  const inDevelopment = projects.filter((p) => ["ADVANCE_VERIFIED", "IN_PROGRESS"].includes(p.status)).length;
  const awaitingReviewOrDelivery = projects.filter((p) =>
    ["SUBMITTED_FOR_DELIVERY", "CLIENT_REVIEW", "DELIVERY_UNLOCKED"].includes(p.status)
  ).length;
  const completed = projects.filter((p) => p.status === "COMPLETED").length;

  // Filtered projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subject.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "ALL") return true;
    if (statusFilter === "ACTIVE") return !["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED_NO_BUILDER"].includes(p.status);
    if (statusFilter === "AWAITING_PAYMENT") return ["AWAITING_ADVANCE", "ADVANCE_PROOF_SUBMITTED", "FINAL_PAYMENT_PENDING"].includes(p.status);
    if (statusFilter === "COMPLETED") return p.status === "COMPLETED";
    return p.status === statusFilter;
  });

  // Calculate deadline urgency
  const now = new Date();
  const getDeadlineStatus = (deadlineStr: string | null) => {
    if (!deadlineStr) return null;
    const d = new Date(deadlineStr);
    const diffHours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours < 0) return { label: "Overdue", color: "bg-red-100 text-red-800 border-red-200" };
    if (diffHours <= 24) return { label: "Due Soon (<24h)", color: "bg-amber-100 text-amber-800 border-amber-200" };
    return { label: "Upcoming", color: "bg-blue-100 text-blue-800 border-blue-200" };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-[#ffe17c] border-2 border-black p-6 sm:p-8 neo-shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm mb-3">
            🎓 Client Command Center
          </span>
          <h1 className="text-2xl sm:text-3xl font-cabinet font-black tracking-tight text-[#171e19]">
            Welcome back, {user.name || user.email}!
          </h1>
          <p className="text-gray-800 font-medium text-sm mt-1 max-w-xl">
            Track and manage your software projects, review builder proposals, monitor escrow milestones, and inspect delivery progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/projects/new"
            className="neo-btn inline-flex items-center px-5 py-3 bg-[#171e19] text-[#ffe17c] font-black text-sm uppercase tracking-wider border-2 border-black neo-shadow"
          >
            + Create New Project
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b-2 border-black overflow-x-auto gap-2 pb-2">
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "projects", label: `📁 My Projects (${totalProjects})` },
          { id: "create", label: "➕ Create Project", href: "/projects/new" },
          { id: "deadlines", label: "⏳ Deadlines" },
          { id: "payments", label: "💳 Payments" },
          { id: "messages", label: "💬 Messages" },
          { id: "notifications", label: `🔔 Notifications (${notifications.filter((n) => !n.read).length})` },
          { id: "profile", label: "👤 Profile" },
        ].map((tab) => {
          if (tab.href) {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="px-3.5 py-2 text-xs font-black uppercase tracking-wider border-2 border-black bg-white text-[#171e19] hover:bg-[#ffe17c] whitespace-nowrap transition"
              >
                {tab.label}
              </Link>
            );
          }
          return (
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
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-gray-600 block">Total Projects</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{totalProjects}</span>
            </div>
            <div className="bg-[#b7c6c2] p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-[#171e19] block">Awaiting Builder</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{awaitingBuilder}</span>
            </div>
            <div className="bg-[#ffe17c] p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-[#171e19] block">Quotations</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{awaitingQuote}</span>
            </div>
            <div className="bg-[#fffdf0] p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-gray-700 block">Awaiting Deposit</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{awaitingPayment}</span>
            </div>
            <div className="bg-white p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-gray-600 block">In Development</span>
              <span className="text-3xl font-cabinet font-black text-[#171e19] mt-1 block">{inDevelopment}</span>
            </div>
            <div className="bg-emerald-100 p-4 border-2 border-black neo-shadow-sm">
              <span className="text-[10px] uppercase tracking-wider font-black text-emerald-950 block">Completed</span>
              <span className="text-3xl font-cabinet font-black text-emerald-800 mt-1 block">{completed}</span>
            </div>
          </div>

          {/* Urgent Deadlines Alert */}
          {projects.some((p) => p.status === "AWAITING_ADVANCE" && p.advancePaymentDeadline) && (
            <div className="p-5 bg-[#ffe17c] border-2 border-black neo-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="text-base font-cabinet font-black text-[#171e19] uppercase tracking-wide">Payment Action Required</h4>
                  <p className="text-xs font-bold text-gray-800 mt-0.5">
                    You have accepted quotation(s) awaiting advance payment deposit. Please deposit advance payment to unlock development.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab("payments");
                }}
                className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm shrink-0"
              >
                View Payment Instructions →
              </button>
            </div>
          )}

          {/* Recent Projects Section */}
          <div className="bg-white border-2 border-black neo-shadow overflow-hidden">
            <div className="p-5 border-b-2 border-black flex items-center justify-between bg-[#fffdf0]">
              <div>
                <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Active Projects Snapshot</h3>
                <p className="text-xs font-bold text-gray-600">Your most recently updated software projects</p>
              </div>
              <button
                onClick={() => setActiveTab("projects")}
                className="neo-btn px-3 py-1 bg-white text-[#171e19] hover:bg-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
              >
                View All Projects ({totalProjects}) →
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-bold text-gray-600 mb-4">You haven&apos;t created any projects yet.</p>
                <Link
                  href="/projects/new"
                  className="neo-btn inline-flex items-center px-5 py-2.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow"
                >
                  Create Your First Project
                </Link>
              </div>
            ) : (
              <div className="divide-y-2 divide-black">
                {projects.slice(0, 5).map((project) => (
                  <div key={project.id} className="p-5 hover:bg-[#ffe17c]/20 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5 uppercase">
                          {project.projectCode}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-black border border-black uppercase ${
                            project.status === "AVAILABLE"
                              ? "bg-emerald-200 text-emerald-950"
                              : project.status === "AWAITING_ADVANCE"
                              ? "bg-[#ffe17c] text-[#171e19]"
                              : project.status === "IN_PROGRESS"
                              ? "bg-white text-[#171e19]"
                              : project.status === "COMPLETED"
                              ? "bg-emerald-200 text-emerald-950"
                              : "bg-gray-200 text-[#171e19]"
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                      <h4 className="text-lg font-cabinet font-black text-[#171e19]">
                        <Link href={`/projects/${project.id}`} className="hover:underline">
                          {project.title}
                        </Link>
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700">
                        <span>Builder: <strong className="text-black">{project.builder?.name || "Awaiting discovery"}</strong></span>
                        <span>
                          Requested Completion:{" "}
                          <strong className="text-black">
                            {project.requestedCompletionDate || "Not specified"}
                          </strong>
                        </span>
                        {project.developmentDeadline && (
                          <span>
                            Official Dev Deadline:{" "}
                            <strong className="text-black">
                              {new Date(project.developmentDeadline).toLocaleDateString()}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="neo-btn px-3.5 py-1.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                      >
                        Project Details →
                      </Link>
                      <Link
                        href={`/projects/${project.id}/messages`}
                        className="neo-btn px-3.5 py-1.5 bg-white hover:bg-[#ffe17c] text-[#171e19] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm"
                      >
                        💬 Messages
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROJECTS */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="bg-white p-4 border-2 border-black neo-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search projects by title, code, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-xs font-bold outline-none focus:bg-[#ffe17c]/20"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {["ALL", "ACTIVE", "AWAITING_PAYMENT", "COMPLETED"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition whitespace-nowrap ${
                    statusFilter === filter
                      ? "bg-[#171e19] text-[#ffe17c]"
                      : "bg-white text-[#171e19] hover:bg-[#ffe17c]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border-2 border-black neo-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y-2 divide-black text-left text-xs">
                <thead className="bg-[#171e19] text-[#ffe17c] uppercase font-black tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Project Code</th>
                    <th className="px-5 py-3.5">Title &amp; Category</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Builder</th>
                    <th className="px-5 py-3.5">Requested Completion</th>
                    <th className="px-5 py-3.5">Official Dev Deadline</th>
                    <th className="px-5 py-3.5">Budget</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black text-gray-800">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-600 font-bold text-sm">
                        No projects match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => (
                      <tr key={p.id} className="hover:bg-[#ffe17c]/20 transition">
                        <td className="px-5 py-4 font-mono font-black text-[#171e19] whitespace-nowrap">
                          <span className="bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-cabinet font-black text-gray-900 text-sm">{p.title}</div>
                          <div className="text-gray-600 font-bold text-[11px]">{p.subject}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-black border border-black uppercase ${
                              p.status === "AVAILABLE"
                                ? "bg-emerald-200 text-emerald-950"
                                : p.status === "AWAITING_ADVANCE"
                                ? "bg-[#ffe17c] text-[#171e19]"
                                : p.status === "IN_PROGRESS"
                                ? "bg-white text-[#171e19]"
                                : p.status === "COMPLETED"
                                ? "bg-emerald-200 text-emerald-950"
                                : "bg-gray-200 text-[#171e19]"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {p.builder ? (
                            <span className="font-bold text-gray-900">{p.builder.name}</span>
                          ) : (
                            <span className="text-gray-500 font-bold italic">Awaiting builder</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-black">
                          {p.requestedCompletionDate || "—"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-gray-800">
                          {p.developmentDeadline
                            ? new Date(p.developmentDeadline).toLocaleDateString()
                            : "Pending verification"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-gray-900">
                          ₹{p.budgetMin.toLocaleString()} - ₹{p.budgetMax.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <Link
                            href={`/projects/${p.id}`}
                            className="neo-btn px-3 py-1 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm inline-block"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEADLINES */}
      {activeTab === "deadlines" && (
        <div className="space-y-4">
          <div className="bg-white p-6 border-2 border-black neo-shadow">
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Project Timeline &amp; Deadlines</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">
              Strictly tracking client requested dates, server-controlled payment windows, and official development deadlines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => {
              const devUrgency = getDeadlineStatus(p.developmentDeadline);
              const paymentUrgency = getDeadlineStatus(p.advancePaymentDeadline);

              return (
                <div key={p.id} className="bg-white p-5 border-2 border-black neo-shadow space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                      <h4 className="text-lg font-cabinet font-black text-[#171e19] mt-1">{p.title}</h4>
                    </div>
                    <span className="px-2.5 py-0.5 bg-gray-200 text-black border border-black text-xs font-black uppercase">
                      {p.status}
                    </span>
                  </div>

                  <div className="divide-y-2 divide-black border-t-2 border-b-2 border-black bg-[#fffdf0] p-3 text-xs space-y-2">
                    {/* Requested Completion Date */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-gray-700 font-bold">Requested Completion Date:</span>
                      <span className="font-black text-black">
                        {p.requestedCompletionDate || "Not specified"}
                      </span>
                    </div>

                    {/* Official Development Deadline */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-gray-700 font-bold">Official Development Deadline:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-900">
                          {p.developmentDeadline
                            ? new Date(p.developmentDeadline).toLocaleDateString()
                            : "Pending advance verification"}
                        </span>
                        {devUrgency && (
                          <span className={`px-2 py-0.5 text-[10px] font-black border border-black uppercase ${devUrgency.color}`}>
                            {devUrgency.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Advance Payment Deadline */}
                    {p.status === "AWAITING_ADVANCE" && p.advancePaymentDeadline && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-gray-700 font-bold">Advance Payment Window:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#171e19]">
                            {new Date(p.advancePaymentDeadline).toLocaleString()}
                          </span>
                          {paymentUrgency && (
                            <span className={`px-2 py-0.5 text-[10px] font-black border border-black uppercase ${paymentUrgency.color}`}>
                              {paymentUrgency.label}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Link
                      href={`/projects/${p.id}`}
                      className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm inline-block"
                    >
                      Inspect Timeline in Project Details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: PAYMENTS & ESCROW */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="bg-white p-6 border-2 border-black neo-shadow">
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Payment &amp; Escrow Summary</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">
              BuildMate protects clients with strict 30% advance escrow and milestone release. Exact figures are verified and locked by the server upon submission.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Projects List */}
            <div className="lg:col-span-2 space-y-4">
              {projects
                .filter((p) => p.totalPrice || p.advanceAmount)
                .map((p) => (
                  <div key={p.id} className="bg-white p-5 border-2 border-black neo-shadow space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                        <h4 className="text-lg font-cabinet font-black text-[#171e19] mt-1">{p.title}</h4>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-black uppercase border border-black bg-[#ffe17c] text-[#171e19]">
                        {p.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 p-3 bg-[#fffdf0] border-2 border-black text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Total Agreed</span>
                        <span className="font-cabinet font-black text-gray-900 text-base">₹{p.totalPrice?.toLocaleString() || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-[#171e19] block">Advance (30%)</span>
                        <span className="font-cabinet font-black text-[#171e19] text-base">₹{p.advanceAmount?.toLocaleString() || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-gray-600 block">Remaining (70%)</span>
                        <span className="font-cabinet font-black text-gray-900 text-base">₹{p.remainingAmount?.toLocaleString() || "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t-2 border-black text-xs">
                      <span className="font-bold text-gray-700">
                        {p.payment ? `Payment Status: ${p.payment.status}` : "Payment Proof: Not yet uploaded"}
                      </span>
                      <Link
                        href={`/projects/${p.id}`}
                        className="neo-btn px-3 py-1.5 bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm inline-block"
                      >
                        Go to Payment &amp; Upload Proof →
                      </Link>
                    </div>
                  </div>
                ))}

              {projects.filter((p) => p.totalPrice || p.advanceAmount).length === 0 && (
                <div className="bg-white p-8 border-2 border-black neo-shadow text-center text-sm font-bold text-gray-600">
                  No active quotations or payment schedules yet. Once a builder submits a quotation and you accept, payment schedules will appear here.
                </div>
              )}
            </div>

            {/* Official Payment QR & Instructions Card */}
            <div className="bg-white p-6 border-2 border-black neo-shadow space-y-4">
              <div className="text-center">
                <span className="text-xs font-black uppercase tracking-wider text-[#171e19] bg-[#ffe17c] border border-black px-2 py-0.5 inline-block">Official Payment Channel</span>
                <h4 className="text-xl font-cabinet font-black text-[#171e19] mt-2">Platform UPI Escrow</h4>
                <p className="text-xs font-bold text-gray-600 mt-0.5">
                  Scan to make the required advance or milestone payment
                </p>
              </div>

              <div className="flex justify-center p-4 bg-[#fffdf0] border-2 border-black neo-shadow-sm">
                <Image
                  src="/images/payment-qr.svg"
                  alt="BuildMate Official Escrow Payment QR"
                  width={200}
                  height={200}
                  className="border-2 border-black"
                  priority
                />
              </div>

              <div className="space-y-2 text-xs text-gray-800 bg-[#ffe17c]/30 p-3.5 border-2 border-black">
                <p className="font-black text-[#171e19] uppercase tracking-wide">Payment Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 font-bold text-[#171e19]">
                  <li>Scan the QR using your UPI or Banking application.</li>
                  <li>Transfer the exact required advance amount for your project.</li>
                  <li>Save the transaction ID / UTR and receipt screenshot.</li>
                  <li>After payment, upload the payment proof in your project view.</li>
                </ol>
                <p className="text-[11px] font-bold text-gray-700 pt-1 italic">
                  Note: Payment verification remains strictly server and administrator controlled. Development starts upon verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MESSAGES */}
      {activeTab === "messages" && (
        <div className="bg-white border-2 border-black neo-shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Project Messages &amp; Discussions</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">Communicate directly with your assigned builder on active projects</p>
          </div>

          {projects.filter((p) => p.builder).length === 0 ? (
            <div className="p-8 text-center bg-[#fffdf0] border-2 border-dashed border-black">
              <span className="text-4xl block mb-2">💬</span>
              <h4 className="text-base font-cabinet font-black text-[#171e19] uppercase">No Active Builder Discussions</h4>
              <p className="text-xs font-bold text-gray-600 max-w-sm mx-auto mt-1">
                Once a verified builder accepts your project, a dedicated, participant-only communication channel will open here and on the project page.
              </p>
            </div>
          ) : (
            <div className="divide-y-2 divide-black">
              {projects
                .filter((p) => p.builder)
                .map((p) => (
                  <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-[#171e19] bg-[#ffe17c] border border-black px-1.5 py-0.5">{p.projectCode}</span>
                        <h4 className="text-base font-cabinet font-black text-[#171e19]">{p.title}</h4>
                      </div>
                      <p className="text-xs font-bold text-gray-700 mt-1">
                        Assigned Builder: <span className="font-black text-black">{p.builder?.name || p.builder?.email}</span>
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

      {/* TAB 6: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="bg-white border-2 border-black neo-shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Notifications &amp; Activity Log</h3>
            <p className="text-xs font-bold text-gray-600 mt-0.5">Platform alerts, milestone updates, and deadline notices</p>
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm font-bold text-gray-600 italic py-6 text-center">No notifications yet.</p>
          ) : (
            <div className="divide-y-2 divide-black">
              {notifications.map((n) => (
                <div key={n.id} className="py-3.5 flex items-start gap-3">
                  <span className={`w-3 h-3 border border-black mt-1.5 shrink-0 ${n.read ? "bg-gray-300" : "bg-[#ffe17c]"}`} />
                  <div className="flex-1">
                    <p className={`text-sm ${n.read ? "text-gray-700 font-medium" : "font-black text-[#171e19]"}`}>
                      {n.message}
                    </p>
                    <span className="text-xs font-bold text-gray-500">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
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
            <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">Account Profile</h3>
            <p className="text-xs font-bold text-gray-600">Your verified client account credentials and platform role</p>
          </div>

          <div className="space-y-4 divide-y-2 divide-black text-sm">
            <div className="flex justify-between py-2">
              <span className="text-gray-700 font-bold">Full Name</span>
              <span className="font-black text-[#171e19]">{user.name || "Not set"}</span>
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
                CLIENT (Verified)
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-700 font-bold">Authentication</span>
              <span className="font-bold text-[#171e19]">Argon2id Encrypted Password</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
