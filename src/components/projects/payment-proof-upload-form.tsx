"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PaymentProofUploadFormProps {
  projectId: string;
  projectCode: string;
  expectedAmount: number;
  paymentType: "ADVANCE" | "FINAL";
  advancePaymentDeadline?: string | null;
  rejectionReason?: string | null;
}

export function PaymentProofUploadForm({
  projectId,
  projectCode,
  expectedAmount,
  paymentType,
  advancePaymentDeadline,
  rejectionReason,
}: PaymentProofUploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
      const ext = "." + selected.name.split(".").pop()?.toLowerCase();

      if (!validExtensions.includes(ext)) {
        setError("Invalid file format. Please upload JPG, PNG, or WebP.");
        setFile(null);
        return;
      }

      if (selected.size > 5 * 1024 * 1024) {
        setError("File size exceeds 5 MB limit.");
        setFile(null);
        return;
      }

      setError(null);
      setFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a screenshot file of your payment proof.");
      return;
    }
    if (!transactionRef.trim() || transactionRef.trim().length < 3) {
      setError("Please enter a valid transaction reference (min 3 chars).");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Request presigned upload URL
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const presignedRes = await fetch("/api/payments/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          extension: ext,
          mimeType: file.type || "image/png",
        }),
      });

      const presignedData = await presignedRes.json();
      if (!presignedRes.ok) {
        throw new Error(presignedData.error || "Failed to initiate upload.");
      }

      const { uploadUrl, storageKey } = presignedData;

      // 2. Direct upload to storage via presigned PUT
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "image/png",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload screenshot to storage.");
      }

      // 3. Submit proof metadata to finalize verification request
      const proofRes = await fetch("/api/payments/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          transactionReference: transactionRef.trim(),
          storageKey,
          fileType: file.type || "image/png",
          fileSize: file.size,
        }),
      });

      const proofData = await proofRes.json();
      if (!proofRes.ok) {
        throw new Error(proofData.error || "Failed to submit payment proof.");
      }

      setSuccessMsg(proofData.message || "Payment proof submitted successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during submission.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-black neo-shadow-md p-6 sm:p-8 font-body text-[#171e19]">
      {rejectionReason && (
        <div className="mb-6 p-4 bg-rose-200 border-2 border-black rounded-xl text-black text-xs font-bold neo-shadow-sm">
          <span className="font-heading font-black uppercase tracking-wider block mb-1">Previous Proof Rejected</span>
          <span>Reason: {rejectionReason}</span>
          <span className="block mt-1 font-medium text-black/80">
            Please review the payment details below and upload a fresh proof.
          </span>
        </div>
      )}

      <div className="border-b-2 border-black/10 pb-5 mb-6">
        <span className="font-heading font-black text-xs uppercase tracking-wider px-2.5 py-1 bg-[#ffe17c] text-black border border-black rounded inline-block mb-2">
          Secure Escrow Deposit
        </span>
        <h2 className="text-xl sm:text-2xl font-heading font-black text-black tracking-tight">
          {paymentType === "ADVANCE" ? "Advance Payment Deposit" : "Final Delivery Payment"}
        </h2>
        <p className="text-xs text-black/70 font-semibold mt-1">
          Scan the UPI QR code or transfer to our payment ID, then submit your transaction reference and screenshot for admin verification.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: QR Code and Instructions */}
        <div className="flex flex-col items-center p-6 bg-[#fffdf0] rounded-2xl border-2 border-black text-center neo-shadow-sm">
          <span className="text-[11px] font-heading font-black uppercase tracking-wider text-black bg-[#ffe17c] px-2 py-0.5 border border-black rounded mb-2">
            Payment Instruction
          </span>
          <h3 className="text-base font-heading font-black text-black mb-3">Scan UPI QR to Pay</h3>
          <div className="p-4 bg-white rounded-xl border-2 border-black neo-shadow-sm mb-3">
            <img
              src="/images/payment-qr.svg"
              alt="BuildMate Payment QR"
              width={200}
              height={200}
              className="rounded"
            />
          </div>
          <p className="text-xs text-black/70 mb-4 font-semibold">
            After completing payment, submit the receipt proof below.
          </p>

          <div className="w-full space-y-2 border-t-2 border-black/10 pt-3">
            <div className="flex justify-between items-center text-xs py-1 border-b border-black/10">
              <span className="font-bold text-black/60">Amount Due:</span>
              <span className="font-heading font-black text-black text-lg">₹{expectedAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs py-1 border-b border-black/10">
              <span className="font-bold text-black/60">UPI ID:</span>
              <span className="font-mono font-black text-black select-all bg-white px-2 py-0.5 border border-black rounded">
                buildmate@bank
              </span>
            </div>
            {advancePaymentDeadline && (
              <div className="flex justify-between items-center text-xs py-1">
                <span className="font-bold text-black/60">Deadline:</span>
                <span className="text-black font-mono font-bold">
                  {new Date(advancePaymentDeadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-200 border-2 border-black text-black text-xs font-bold rounded-xl neo-shadow-sm">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-200 border-2 border-black text-black text-xs font-bold rounded-xl neo-shadow-sm">
              {successMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
              Transaction Reference / UTR Number <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. 12-digit UTR: 423982938120"
              className="w-full text-xs p-3 border-2 border-black rounded-xl focus:bg-[#ffe17c]/20 focus:outline-none font-mono font-bold"
            />
            <span className="text-[11px] text-black/50 font-semibold mt-1 block">
              Found on your banking/UPI payment confirmation screen.
            </span>
          </div>

          <div>
            <label className="block text-xs font-heading font-black text-black uppercase tracking-wider mb-1.5">
              Payment Screenshot / Receipt <span className="text-rose-600">*</span>
            </label>
            <input
              type="file"
              required
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="w-full text-xs p-2.5 border-2 border-black rounded-xl file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-heading file:font-black file:bg-[#ffe17c] file:text-black cursor-pointer bg-white"
            />
            <span className="text-[11px] text-black/50 font-semibold mt-1 block">
              PNG, JPG, or WebP up to 5 MB.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting || !file || !transactionRef.trim()}
            className="neo-btn w-full py-3.5 px-4 bg-black hover:bg-black/90 disabled:opacity-50 text-white text-xs font-heading font-black uppercase tracking-wider rounded-xl transition"
          >
            {submitting ? "Uploading & Submitting..." : "Submit Payment Proof →"}
          </button>
        </form>
      </div>
    </div>
  );
}
