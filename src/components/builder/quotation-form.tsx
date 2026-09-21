"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuotationForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [totalPriceStr, setTotalPriceStr] = useState("");
  const [durationDaysStr, setDurationDaysStr] = useState("14");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const numericTotal = parseInt(totalPriceStr, 10);
  const isValidNumber = !isNaN(numericTotal) && numericTotal > 0;

  const numericDuration = parseInt(durationDaysStr, 10);
  const isValidDuration = !isNaN(numericDuration) && numericDuration >= 1 && numericDuration <= 365;

  // Canonical V1 preview calculation:
  // advanceAmount = min(totalPrice, max(300, floor(totalPrice * 0.30)))
  const previewAdvance = isValidNumber
    ? Math.min(numericTotal, Math.max(300, Math.floor(numericTotal * 0.3)))
    : null;
  const previewRemaining = isValidNumber && previewAdvance !== null
    ? numericTotal - previewAdvance
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidNumber) {
      setError("Please enter a valid positive whole number for total price.");
      return;
    }
    if (!isValidDuration) {
      setError("Please enter an estimated duration between 1 and 365 days.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: numericTotal,
          estimatedDurationDays: numericDuration,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit quotation.");
      }

      setSuccess(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm">
        ✅ Quotation submitted successfully! Refreshing status...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">Prepare & Submit Quotation</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Enter your total quotation price for the full project scope. The advance deposit and remaining schedule will be calculated automatically based on platform rules.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="totalPrice" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Total Price (₹)
          </label>
          <div className="relative rounded-lg shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-gray-500 text-sm">₹</span>
            </div>
            <input
              type="number"
              id="totalPrice"
              name="totalPrice"
              min="1"
              step="1"
              required
              value={totalPriceStr}
              onChange={(e) => setTotalPriceStr(e.target.value)}
              placeholder="e.g. 1500"
              className="block w-full rounded-lg border border-gray-300 pl-8 pr-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Whole numbers only.</p>
        </div>

        <div>
          <label htmlFor="estimatedDurationDays" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Estimated Duration (Days) *
          </label>
          <input
            type="number"
            id="estimatedDurationDays"
            name="estimatedDurationDays"
            min="1"
            max="365"
            step="1"
            required
            value={durationDaysStr}
            onChange={(e) => setDurationDaysStr(e.target.value)}
            placeholder="e.g. 14"
            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Expected project timeline (1 - 365 days).</p>
        </div>

        {isValidNumber && previewAdvance !== null && previewRemaining !== null && (
          <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-3.5 text-xs text-blue-900 space-y-1">
            <div className="font-semibold text-blue-950 flex items-center gap-1.5">
              <span>ℹ️</span> Estimated Payment Schedule Preview
            </div>
            <div className="flex justify-between pt-1 text-blue-800">
              <span>Required Advance:</span>
              <span className="font-bold">₹{previewAdvance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-blue-800">
              <span>Remaining Balance:</span>
              <span className="font-bold">₹{previewRemaining.toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-blue-600/80 pt-1 italic">
              * Preview only. Exact figures are verified and locked by the server upon submission.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !isValidNumber || !isValidDuration}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition shadow-sm"
        >
          {loading ? "Submitting Quotation..." : "Submit Quotation to Client"}
        </button>
      </div>
    </form>
  );
}
