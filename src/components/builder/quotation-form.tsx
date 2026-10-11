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
      <div className="bg-emerald-200 border-2 border-black text-black p-5 rounded-2xl text-sm font-bold neo-shadow-sm">
        ✅ Quotation submitted successfully! Refreshing project status...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-black neo-shadow-md p-6 sm:p-8 font-body text-[#171e19]">
      <div className="mb-6">
        <span className="font-heading font-black text-xs uppercase tracking-wider px-2.5 py-1 bg-[#ffe17c] text-black border border-black rounded inline-block mb-2">
          Quotation Proposal
        </span>
        <h3 className="text-xl sm:text-2xl font-heading font-black text-black tracking-tight">Prepare &amp; Submit Quotation</h3>
        <p className="text-xs text-black/70 font-semibold mt-1">
          Enter your total quotation price and estimated timeline. The advance deposit and remaining schedule are verified and locked by platform escrow rules upon submission.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 bg-rose-200 border-2 border-black rounded-xl text-xs text-black font-bold neo-shadow-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Total Price */}
        <div>
          <label htmlFor="totalPrice" className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
            Total Price (₹) <span className="text-rose-600">*</span>
          </label>
          <div className="relative rounded-xl">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <span className="text-black font-black text-sm">₹</span>
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
              className={`block w-full rounded-xl border-2 pl-9 pr-4 py-3 text-sm font-bold text-black focus:outline-none focus:bg-[#ffe17c]/20 ${
                priceError
                  ? "border-rose-600 bg-rose-50"
                  : "border-black bg-white"
              }`}
            />
          </div>
          {priceError ? (
            <p className="text-xs text-rose-700 mt-1 font-bold">{priceError}</p>
          ) : (
            <p className="text-xs text-black/50 font-semibold mt-1">Whole numbers only (e.g. 500, 1500).</p>
          )}
        </div>

        {/* Estimated Development Duration */}
        <div>
          <label htmlFor="estimatedDurationDays" className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
            Estimated Development Duration (Days) <span className="text-rose-600">*</span>
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
            className={`block w-full rounded-xl border-2 px-4 py-3 text-sm font-bold text-black focus:outline-none focus:bg-[#ffe17c]/20 ${
              durationError
                ? "border-rose-600 bg-rose-50"
                : "border-black bg-white"
            }`}
          />
          {durationError ? (
            <p className="text-xs text-rose-700 mt-1 font-bold">{durationError}</p>
          ) : (
            <p className="text-xs text-black/50 font-semibold mt-1">Expected project timeline (integer between 1 and 365 days).</p>
          )}
        </div>

        {/* Payment Preview */}
        {numericTotal !== null && previewAdvance !== null && previewRemaining !== null && (
          <div className="bg-[#b7c6c2]/40 border-2 border-black rounded-2xl p-5 text-xs text-black space-y-3 neo-shadow-sm">
            <div className="font-heading font-black text-black flex items-center gap-2 text-sm uppercase tracking-wider">
              <span>ℹ️</span> Estimated Payment Schedule Preview
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t-2 border-black/10">
              <div className="bg-white p-3.5 rounded-xl border-2 border-black">
                <span className="block text-[11px] font-heading font-black text-black/60 uppercase">Required Advance:</span>
                <span className="text-lg font-heading font-black text-emerald-800">₹{previewAdvance.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border-2 border-black">
                <span className="block text-[11px] font-heading font-black text-black/60 uppercase">Remaining Balance:</span>
                <span className="text-lg font-heading font-black text-black">₹{previewRemaining.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-[11px] text-black/70 font-semibold italic">
              Preview only. Exact figures are verified and locked by the server upon submission.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !isFormValid}
          className="neo-btn w-full sm:w-auto px-7 py-3.5 bg-black hover:bg-black/90 disabled:opacity-50 text-white font-heading font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black transition"
        >
          {loading ? "Submitting Quotation..." : "Submit Quotation to Client →"}
        </button>
      </div>
    </form>
  );
}
