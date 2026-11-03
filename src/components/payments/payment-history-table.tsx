"use client";

import { useState } from "react";
import Link from "next/link";

export interface PaymentHistoryRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  type: "ADVANCE" | "FINAL";
  amount: number;
  status: string;
  verifiedAt: string | null;
  createdAt: string;
  submittedAt?: string | null;
  transactionReference?: string | null;
  razorpayPaymentId?: string | null;
  truncatedPaymentId?: string | null;
  rejectionReason?: string | null;
}

interface PaymentHistoryTableProps {
  initialPayments: PaymentHistoryRow[];
  role: "BUILDER" | "CLIENT" | "ADMIN";
  totalCount?: number;
  pageSize?: number;
  baseProjectHrefPrefix?: string; // "/builder/projects" or "/projects"
}

export function formatTruncatedPaymentId(id: string | null | undefined): string {
  if (!id) return "—";
  const trimmed = id.trim();
  if (trimmed.length <= 6) return trimmed;
  return `...${trimmed.slice(-6)}`;
}

export function formatPaymentDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "VERIFIED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-emerald-300 text-emerald-950 border border-black neo-shadow-sm">
          ✓ Verified
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-rose-200 text-rose-950 border border-black neo-shadow-sm">
          ✕ Rejected
        </span>
      );
    case "UNDER_REVIEW":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-blue-200 text-blue-950 border border-black neo-shadow-sm">
          ⏳ In Review
        </span>
      );
    case "AWAITING":
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-[#ffe17c] text-[#171e19] border border-black neo-shadow-sm">
          🕒 Awaiting
        </span>
      );
  }
}

export function PaymentHistoryTable({
  initialPayments,
  role,
  totalCount,
  pageSize = 10,
  baseProjectHrefPrefix,
}: PaymentHistoryTableProps) {
  const [payments, setPayments] = useState<PaymentHistoryRow[]>(initialPayments);
  const [total, setTotal] = useState<number>(totalCount ?? initialPayments.length);
  const [offset, setOffset] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.floor(offset / pageSize) + 1;

  async function loadPage(newOffset: number) {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/payments/history?role=${role}&limit=${pageSize}&offset=${newOffset}`
      );
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        if (data.pagination) {
          setTotal(data.pagination.total);
          setOffset(data.pagination.offset);
        }
      }
    } catch (err) {
      console.error("Failed to load payment history page:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter and sort displayed payments
  const displayedPayments = payments
    .filter((p) => {
      if (statusFilter === "ALL") return true;
      return p.status === statusFilter;
    })
    .sort((a, b) => {
      const timeA = new Date(a.verifiedAt || a.createdAt).getTime();
      const timeB = new Date(b.verifiedAt || b.createdAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  return (
    <div className="bg-white border-2 border-black neo-shadow overflow-hidden">
      {/* Header Bar */}
      <div className="p-5 border-b-2 border-black flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#fffdf0]">
        <div>
          <h3 className="text-lg font-cabinet font-black text-[#171e19] uppercase tracking-wide">
            Payment History
          </h3>
          <p className="text-xs font-bold text-gray-600">
            {role === "BUILDER"
              ? "All verified and rejected payment transactions across your assigned projects."
              : role === "ADMIN"
              ? "All payment transactions across all projects system-wide."
              : "All payment transactions across your software projects."}
          </p>
        </div>

        {/* Filter and Sort Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="payment-status-filter" className="text-xs font-black uppercase tracking-wider text-black">
              Status:
            </label>
            <select
              id="payment-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border-2 border-black px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#171e19] focus:outline-none focus:bg-[#ffe17c] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="UNDER_REVIEW">In Review</option>
              <option value="AWAITING">Awaiting</option>
              <option value="ORDER_CREATED">Order Created</option>
            </select>
          </div>

          {/* Date Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#ffe17c] border-2 border-black text-xs font-black uppercase tracking-wider text-[#171e19] transition"
            title="Toggle sort order by date"
          >
            <span>Date:</span>
            <span>{sortOrder === "desc" ? "Newest First ▼" : "Oldest First ▲"}</span>
          </button>

          <span className="text-xs font-black uppercase tracking-wider bg-[#ffe17c] border border-black px-2.5 py-1">
            Total: {statusFilter === "ALL" ? total : displayedPayments.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" aria-label="Payment History Table">
          <thead>
            <tr className="bg-[#171e19] text-[#ffe17c] text-xs font-black uppercase tracking-wider border-b-2 border-black">
              <th className="p-3.5 border-r border-white/20">Project Code</th>
              <th className="p-3.5 border-r border-white/20">Type</th>
              <th className="p-3.5 border-r border-white/20">Amount</th>
              <th className="p-3.5 border-r border-white/20">Status</th>
              <th className="p-3.5 border-r border-white/20">Submitted Date</th>
              <th
                onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                className="p-3.5 border-r border-white/20 cursor-pointer hover:bg-white/10 select-none"
                title="Click to sort by date"
              >
                Verified Date {sortOrder === "desc" ? "▼" : "▲"}
              </th>
              <th className="p-3.5">Transaction Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black text-xs font-medium">
            {displayedPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-600 font-bold">
                  {isLoading ? "Loading payment records..." : "No payment records found."}
                </td>
              </tr>
            ) : (
              displayedPayments.map((p) => {
                const projectLink = baseProjectHrefPrefix
                  ? `${baseProjectHrefPrefix}/${p.projectId}`
                  : null;
                const truncatedId =
                  p.truncatedPaymentId || formatTruncatedPaymentId(p.transactionReference || p.razorpayPaymentId);

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-[#ffe17c]/20 transition border-b border-black"
                  >
                    {/* Project Code */}
                    <td className="p-3.5 border-r-2 border-black font-bold whitespace-nowrap">
                      {projectLink ? (
                        <Link
                          href={projectLink}
                          className="font-mono font-black text-[#171e19] bg-[#ffe17c] px-2 py-0.5 border border-black neo-shadow-sm hover:bg-black hover:text-[#ffe17c] transition inline-block"
                        >
                          {p.projectCode}
                        </Link>
                      ) : (
                        <span className="font-mono font-black text-[#171e19] bg-[#ffe17c] px-2 py-0.5 border border-black">
                          {p.projectCode}
                        </span>
                      )}
                      <span className="block text-[11px] text-gray-600 font-medium truncate max-w-[180px] mt-0.5">
                        {p.projectTitle}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="p-3.5 border-r-2 border-black whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-black uppercase tracking-wider border border-black ${
                          p.type === "ADVANCE"
                            ? "bg-[#b7c6c2] text-[#171e19]"
                            : "bg-[#ffe17c] text-[#171e19]"
                        }`}
                      >
                        {p.type}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="p-3.5 border-r-2 border-black whitespace-nowrap font-cabinet font-black text-sm text-[#171e19]">
                      ₹{p.amount?.toLocaleString() ?? "0"}
                    </td>

                    {/* Status */}
                    <td className="p-3.5 border-r-2 border-black whitespace-nowrap">
                      <PaymentStatusBadge status={p.status} />
                      {p.rejectionReason && (
                        <span className="block text-[10px] text-rose-700 italic max-w-[150px] truncate mt-0.5" title={p.rejectionReason}>
                          Reason: {p.rejectionReason}
                        </span>
                      )}
                    </td>

                    {/* Submitted Date */}
                    <td className="p-3.5 border-r-2 border-black whitespace-nowrap text-gray-700 font-bold">
                      {formatPaymentDate(p.submittedAt || p.createdAt)}
                    </td>

                    {/* Verified Date */}
                    <td className="p-3.5 border-r-2 border-black whitespace-nowrap text-gray-700 font-bold">
                      {formatPaymentDate(p.verifiedAt)}
                    </td>

                    {/* Transaction Reference (truncated, last 6 chars) */}
                    <td className="p-3.5 whitespace-nowrap font-mono font-bold text-gray-800">
                      {truncatedId}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {total > 0 && (
        <div className="p-4 border-t-2 border-black bg-[#fffdf0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold">
          <div>
            Showing{" "}
            <span className="font-black text-black">
              {Math.min(offset + 1, total)}
            </span>{" "}
            to{" "}
            <span className="font-black text-black">
              {Math.min(offset + payments.length, total)}
            </span>{" "}
            of <span className="font-black text-black">{total}</span> payments
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadPage(Math.max(0, offset - pageSize))}
              disabled={offset === 0 || isLoading}
              className="neo-btn px-3 py-1.5 bg-white text-[#171e19] border-2 border-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#ffe17c] transition text-xs font-black uppercase tracking-wider"
            >
              ← Previous
            </button>
            <span className="px-2 font-black text-black">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => loadPage(offset + pageSize)}
              disabled={offset + payments.length >= total || isLoading}
              className="neo-btn px-3 py-1.5 bg-white text-[#171e19] border-2 border-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#ffe17c] transition text-xs font-black uppercase tracking-wider"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
