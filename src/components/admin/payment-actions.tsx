\"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PaymentActionsProps {
  paymentId: string;
  projectCode: string;
  expectedAmount: number;
  isLate: boolean;
}

export function PaymentActions({
  paymentId,
  projectCode,
  expectedAmount,
  isLate,
}: PaymentActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleVerify = async () => {
    if (!confirm(`Are you sure you want to verify ₹${expectedAmount} payment for ${projectCode}? This will unlock the project lifecycle.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/verify`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify payment.");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to verify payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setError("Please specify a rejection reason.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject payment.");
      }

      setShowRejectModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to reject payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 font-body text-[#171e19]">
      {error && (
        <div className="p-2.5 bg-rose-200 border-2 border-black text-black font-bold text-xs rounded-xl neo-shadow-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handleVerify}
          disabled={loading}
          className="neo-btn px-3.5 py-1.5 bg-[#ffe17c] hover:bg-emerald-300 disabled:opacity-50 text-black text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black transition"
        >
          {loading ? "Processing..." : isLate ? "Verify Late ✓" : "Verify ✓"}
        </button>

        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="neo-btn px-3.5 py-1.5 bg-white hover:bg-rose-200 text-black border-2 border-black text-xs font-heading font-black uppercase tracking-wider rounded-xl transition"
        >
          Reject
        </button>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 border-2 border-black neo-shadow-lg text-left">
            <h3 className="text-xl font-heading font-black text-black mb-1">
              Reject Payment Proof
            </h3>
            <p className="text-xs text-black/70 font-semibold mb-4 leading-relaxed">
              Specify the reason for rejecting payment for {projectCode}. This will be communicated directly to the client.
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-heading font-black uppercase tracking-wider text-black mb-1.5">
                  Rejection Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Transaction reference is unreadable or amount on receipt does not match expected amount."
                  rows={3}
                  required
                  className="w-full text-xs p-3 border-2 border-black rounded-xl focus:bg-[#ffe17c]/20 focus:outline-none font-medium leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="neo-btn px-4 py-2 text-xs font-heading font-black uppercase text-black bg-white hover:bg-gray-100 rounded-xl border-2 border-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !rejectionReason.trim()}
                  className="neo-btn px-4 py-2 bg-black hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black transition"
                >
                  {loading ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
