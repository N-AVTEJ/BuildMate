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
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm mb-2">
            Client Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {user.name || user.email}!
          </h1>
          <p className="text-blue-100 text-sm mt-1 max-w-xl">
            Track and manage your software projects, review builder proposals, monitor escrow milestones, and inspect delivery progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/projects/new"
            className="inline-flex items-center px-4 py-2.5 bg-white text-blue-900 font-semibold text-sm rounded-xl shadow hover:bg-blue-50 transition"
          >
            + Create New Project
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto gap-1">
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
                className="px-4 py-2.5 text-sm font-semibold border-b-2 border-transparent text-blue-600 hover:text-blue-700 hover:border-blue-300 whitespace-nowrap transition"
              >
                {tab.label}
              </Link>
            );
          }
          return (
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
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-gray-500 block font-medium">Total Projects</span>
              <span className="text-2xl font-bold text-gray-900 mt-1 block">{totalProjects}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-blue-600 block font-medium">Awaiting Builder</span>
              <span className="text-2xl font-bold text-blue-700 mt-1 block">{awaitingBuilder}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-amber-600 block font-medium">Quotations</span>
              <span className="text-2xl font-bold text-amber-700 mt-1 block">{awaitingQuote}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-purple-600 block font-medium">Awaiting Payment</span>
              <span className="text-2xl font-bold text-purple-700 mt-1 block">{awaitingPayment}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-indigo-600 block font-medium">In Development</span>
              <span className="text-2xl font-bold text-indigo-700 mt-1 block">{inDevelopment}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs text-emerald-600 block font-medium">Completed</span>
              <span className="text-2xl font-bold text-emerald-700 mt-1 block">{completed}</span>
            </div>
          </div>

          {/* Urgent Deadlines Alert */}
          {projects.some((p) => p.status === "AWAITING_ADVANCE" && p.advancePaymentDeadline) && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Payment Action Required</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    You have accepted quotation(s) awaiting advance payment deposit. Please deposit advance payment to unlock development.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab("payments");
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition shrink-0"
              >
                View Payment Instructions →
              </button>
            </div>
          )}

          {/* Recent Projects Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Active Projects Snapshot</h3>
                <p className="text-xs text-gray-500">Your most recently updated software projects</p>
              </div>
              <button
                onClick={() => setActiveTab("projects")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View All Projects ({totalProjects}) →
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-gray-500 mb-4">You haven&apos;t created any projects yet.</p>
                <Link
                  href="/projects/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
                >
                  Create Your First Project
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {projects.slice(0, 5).map((project) => (
                  <div key={project.id} className="p-4 sm:p-5 hover:bg-gray-50/50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-600 uppercase">
                          {project.projectCode}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            project.status === "AVAILABLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : project.status === "AWAITING_ADVANCE"
                              ? "bg-purple-100 text-purple-800"
                              : project.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800"
                              : project.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900">
                        <Link href={`/projects/${project.id}`} className="hover:text-blue-600 transition">
                          {project.title}
                        </Link>
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Builder: {project.builder?.name || "Awaiting discovery"}</span>
                        <span>
                          Requested Completion:{" "}
                          <strong className="text-gray-700">
                            {project.requestedCompletionDate || "Not specified"}
                          </strong>
                        </span>
                        {project.developmentDeadline && (
                          <span>
                            Official Dev Deadline:{" "}
                            <strong className="text-gray-700">
                              {new Date(project.developmentDeadline).toLocaleDateString()}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition"
                      >
                        Project Details →
                      </Link>
                      <Link
                        href={`/projects/${project.id}/messages`}
                        className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition"
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
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search projects by title, code, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {["ALL", "ACTIVE", "AWAITING_PAYMENT", "COMPLETED"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                    statusFilter === filter
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Project Code</th>
                    <th className="px-5 py-3.5">Title & Category</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Builder</th>
                    <th className="px-5 py-3.5">Requested Completion</th>
                    <th className="px-5 py-3.5">Official Dev Deadline</th>
                    <th className="px-5 py-3.5">Budget</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500 text-sm">
                        No projects match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/60 transition">
                        <td className="px-5 py-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                          {p.projectCode}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-gray-900 text-sm">{p.title}</div>
                          <div className="text-gray-500 text-[11px]">{p.subject}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                              p.status === "AVAILABLE"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.status === "AWAITING_ADVANCE"
                                ? "bg-purple-100 text-purple-800"
                                : p.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-800"
                                : p.status === "COMPLETED"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {p.builder ? (
                            <span className="font-medium text-gray-900">{p.builder.name}</span>
                          ) : (
                            <span className="text-gray-400 italic">Awaiting builder</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-medium text-blue-700">
                          {p.requestedCompletionDate || "—"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-gray-800">
                          {p.developmentDeadline
                            ? new Date(p.developmentDeadline).toLocaleDateString()
                            : "Pending verification"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-medium text-gray-900">
                          ₹{p.budgetMin.toLocaleString()} - ₹{p.budgetMax.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <Link
                            href={`/projects/${p.id}`}
                            className="font-semibold text-blue-600 hover:text-blue-800 transition"
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
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-base font-bold text-gray-900">Project Timeline & Deadlines</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Strictly tracking client requested dates, server-controlled payment windows, and official development deadlines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => {
              const devUrgency = getDeadlineStatus(p.developmentDeadline);
              const paymentUrgency = getDeadlineStatus(p.advancePaymentDeadline);

              return (
                <div key={p.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600">{p.projectCode}</span>
                      <h4 className="text-base font-bold text-gray-900 mt-0.5">{p.title}</h4>
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full font-semibold">
                      {p.status}
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100 border-t border-b border-gray-100 text-xs py-2 space-y-2">
                    {/* Requested Completion Date */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-gray-500">Requested Completion Date:</span>
                      <span className="font-semibold text-blue-700">
                        {p.requestedCompletionDate || "Not specified"}
                      </span>
                    </div>

                    {/* Official Development Deadline */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-gray-500">Official Development Deadline:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {p.developmentDeadline
                            ? new Date(p.developmentDeadline).toLocaleDateString()
                            : "Pending advance verification"}
                        </span>
                        {devUrgency && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${devUrgency.color}`}>
                            {devUrgency.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Advance Payment Deadline */}
                    {p.status === "AWAITING_ADVANCE" && p.advancePaymentDeadline && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-gray-500">Advance Payment Window:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-purple-900">
                            {new Date(p.advancePaymentDeadline).toLocaleString()}
                          </span>
                          {paymentUrgency && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${paymentUrgency.color}`}>
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
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
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
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-base font-bold text-gray-900">Payment & Escrow Summary</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              BuildMate protects clients with strict 30% advance escrow and milestone release. Exact figures are verified and locked by the server upon submission.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Projects List */}
            <div className="lg:col-span-2 space-y-4">
              {projects
                .filter((p) => p.totalPrice || p.advanceAmount)
                .map((p) => (
                  <div key={p.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-blue-600">{p.projectCode}</span>
                        <h4 className="text-base font-bold text-gray-900">{p.title}</h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800">
                        {p.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg text-xs">
                      <div>
                        <span className="text-gray-500 block">Total Agreed</span>
                        <span className="font-bold text-gray-900 text-sm">₹{p.totalPrice?.toLocaleString() || "—"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Advance (30%)</span>
                        <span className="font-bold text-purple-700 text-sm">₹{p.advanceAmount?.toLocaleString() || "—"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Remaining (70%)</span>
                        <span className="font-bold text-gray-900 text-sm">₹{p.remainingAmount?.toLocaleString() || "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      <span className="text-gray-500">
                        {p.payment ? `Payment Status: ${p.payment.status}` : "Payment Proof: Not yet uploaded"}
                      </span>
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Go to Payment &amp; Upload Proof →
                      </Link>
                    </div>
                  </div>
                ))}

              {projects.filter((p) => p.totalPrice || p.advanceAmount).length === 0 && (
                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-sm text-gray-500">
                  No active quotations or payment schedules yet. Once a builder submits a quotation and you accept, payment schedules will appear here.
                </div>
              )}
            </div>

            {/* Official Payment QR & Instructions Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Official Payment Channel</span>
                <h4 className="text-base font-bold text-gray-900 mt-1">Payment QR</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Scan to make the required advance or milestone payment
                </p>
              </div>

              <div className="flex justify-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                <Image
                  src="/images/payment-qr.svg"
                  alt="BuildMate Official Escrow Payment QR"
                  width={200}
                  height={200}
                  className="rounded-lg shadow-sm"
                  priority
                />
              </div>

              <div className="space-y-2 text-xs text-gray-600 bg-blue-50/60 p-3.5 rounded-lg border border-blue-100">
                <p className="font-bold text-blue-950">Payment Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-900">
                  <li>Scan the QR using your UPI or Banking application.</li>
                  <li>Transfer the exact required advance amount for your project.</li>
                  <li>Save the transaction ID / UTR and receipt screenshot.</li>
                  <li>After payment, upload the payment proof in your project view.</li>
                </ol>
                <p className="text-[11px] text-blue-700/80 pt-1 italic">
                  Note: Payment verification remains strictly server and administrator controlled. Development starts upon verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MESSAGES */}
      {activeTab === "messages" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Project Messages &amp; Discussions</h3>
            <p className="text-xs text-gray-500 mt-0.5">Communicate directly with your assigned builder on active projects</p>
          </div>

          {projects.filter((p) => p.builder).length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <span className="text-3xl block mb-2">💬</span>
              <h4 className="text-sm font-semibold text-gray-900">No Active Builder Discussions</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                Once a verified builder accepts your project, a dedicated, participant-only communication channel will open here and on the project page.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {projects
                .filter((p) => p.builder)
                .map((p) => (
                  <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-500">{p.projectCode}</span>
                        <h4 className="text-sm font-bold text-gray-900">{p.title}</h4>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned Builder: <span className="font-semibold text-gray-800">{p.builder?.name || p.builder?.email}</span>
                      </p>
                    </div>
                    <Link
                      href={`/projects/${p.id}#messages`}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition border border-blue-200 inline-flex items-center gap-1.5 shrink-0"
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Notifications &amp; Activity Log</h3>
            <p className="text-xs text-gray-500 mt-0.5">Platform alerts, milestone updates, and deadline notices</p>
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-6 text-center">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <div key={n.id} className="py-3 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-gray-300" : "bg-blue-600"}`} />
                  <div className="flex-1">
                    <p className={`text-sm ${n.read ? "text-gray-700" : "font-semibold text-gray-900"}`}>
                      {n.message}
                    </p>
                    <span className="text-xs text-gray-400">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-gray-900">Account Profile</h3>
            <p className="text-xs text-gray-500">Your verified client account credentials and platform role</p>
          </div>

          <div className="space-y-4 divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Full Name</span>
              <span className="font-semibold text-gray-900">{user.name || "Not set"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Email Address</span>
              <span className="font-semibold text-gray-900">{user.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Phone Number</span>
              <span className="font-semibold text-gray-900">{user.phone || "Not set"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Account Role</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                CLIENT (Verified)
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Authentication</span>
              <span className="font-medium text-gray-700">Argon2id Encrypted Password</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
