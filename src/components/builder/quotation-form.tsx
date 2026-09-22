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
  const [touched, setTouched] = useState({ price: false, duration: false });

  // Integer regex: digits only, no decimals, signs, or scientific notation
  const isStrictIntegerString = (val: string) => /^\d+$/.test(val.trim());

  // Total Price Validation
  const trimmedPrice = totalPriceStr.trim();
  let priceError: string | null = null;
  let numericTotal: number | null = null;

  if (touched.price || trimmedPrice.length > 0) {
    if (trimmedPrice.length === 0) {
      priceError = "Total price is required.";
    } else if (!isStrictIntegerString(trimmedPrice)) {
      priceError = "Total price must be a whole number in rupees (no decimals, negatives, or symbols).";
    } else {
      const parsed = parseInt(trimmedPrice, 10);
      if (isNaN(parsed) || parsed <= 0) {
        priceError = "Total price must be greater than zero.";
      } else {
        numericTotal = parsed;
      }
    }
  }

  // Duration Validation
  const trimmedDuration = durationDaysStr.trim();
  let durationError: string | null = null;
  let numericDuration: number | null = null;

  if (touched.duration || trimmedDuration.length > 0) {
    if (trimmedDuration.length === 0) {
      durationError = "Estimated development duration is required.";
    } else if (!isStrictIntegerString(trimmedDuration)) {
      durationError = "Duration must be an integer (whole number of days, no decimals).";
    } else {
      const parsed = parseInt(trimmedDuration, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 365) {
        durationError = "Development duration must be between 1 and 365 days.";
      } else {
        numericDuration = parsed;
      }
    }
  }

  // Approved BuildMate payment calculation:
  // advance = min(totalPrice, max(300, floor(totalPrice * 0.30)))
  // remaining = totalPrice - advance
  const previewAdvance =
    numericTotal !== null
      ? Math.min(numericTotal, Math.max(300, Math.floor(numericTotal * 0.3)))
      : null;
  const previewRemaining =
    numericTotal !== null && previewAdvance !== null
      ? numericTotal - previewAdvance
      : null;

  const isFormValid =
    numericTotal !== null &&
    priceError === null &&
    numericDuration !== null &&
    durationError === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ price: true, duration: true });

    if (!isFormValid || numericTotal === null || numericDuration === null) {
      setError("Please resolve the validation issues before submitting.");
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
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-medium">
        ✅ Quotation submitted successfully! Refreshing project status...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">Prepare & Submit Quotation</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Enter your total quotation price and estimated timeline. The advance deposit and remaining schedule are verified and locked by platform escrow rules upon submission.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Total Price */}
        <div>
          <label htmlFor="totalPrice" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Total Price (₹) *
          </label>
          <div className="relative rounded-lg shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-gray-500 text-sm font-medium">₹</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              id="totalPrice"
              name="totalPrice"
              required
              value={totalPriceStr}
              onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
              onChange={(e) => {
                setTotalPriceStr(e.target.value);
                if (!touched.price) setTouched((prev) => ({ ...prev, price: true }));
              }}
              placeholder="e.g. 1500"
              className={`block w-full rounded-lg border pl-8 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 ${
                priceError
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              }`}
            />
          </div>
          {priceError ? (
            <p className="text-xs text-red-600 mt-1 font-medium">{priceError}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">Whole numbers only (e.g. 500, 1500).</p>
          )}
        </div>

        {/* Estimated Development Duration */}
        <div>
          <label htmlFor="estimatedDurationDays" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Estimated Development Duration (Days) *
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            id="estimatedDurationDays"
            name="estimatedDurationDays"
            required
            value={durationDaysStr}
            onBlur={() => setTouched((prev) => ({ ...prev, duration: true }))}
            onChange={(e) => {
              setDurationDaysStr(e.target.value);
              if (!touched.duration) setTouched((prev) => ({ ...prev, duration: true }));
            }}
            placeholder="e.g. 14"
            className={`block w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 ${
              durationError
                ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            }`}
          />
          {durationError ? (
            <p className="text-xs text-red-600 mt-1 font-medium">{durationError}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">Expected project timeline (integer between 1 and 365 days).</p>
          )}
        </div>

        {/* Payment Preview */}
        {numericTotal !== null && previewAdvance !== null && previewRemaining !== null && (
          <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-4 text-xs text-blue-900 space-y-2">
            <div className="font-bold text-blue-950 flex items-center gap-1.5 text-sm">
              <span>ℹ️</span> Estimated Payment Schedule Preview
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100">
              <div className="text-blue-800">
                <span className="block text-xs text-blue-600">Required Advance:</span>
                <span className="text-base font-bold text-blue-950">₹{previewAdvance.toLocaleString()}</span>
              </div>
              <div className="text-blue-800">
                <span className="block text-xs text-blue-600">Remaining Balance:</span>
                <span className="text-base font-bold text-blue-950">₹{previewRemaining.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-[11px] text-blue-700/90 pt-1 italic">
              Preview only. Exact figures are verified and locked by the server upon submission.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !isFormValid}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition shadow-sm"
        >
          {loading ? "Submitting Quotation..." : "Submit Quotation to Client"}
        </button>
      </div>
    </form>
  );
}
