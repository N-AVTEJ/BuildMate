"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
      {rejectionReason && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
          <span className="font-bold block mb-1">Previous Proof Rejected</span>
          <span>Reason: {rejectionReason}</span>
          <span className="block mt-1 text-rose-600">
            Please review the payment details below and upload a fresh proof.
          </span>
        </div>
      )}

      <div className="border-b border-gray-100 pb-4 mb-6">
        <h2 className="text-lg font-bold text-gray-900">
          {paymentType === "ADVANCE" ? "Advance Payment" : "Final Payment"}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Scan the static UPI QR code or transfer to our payment ID, then submit your transaction reference and screenshot.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: QR Code and Instructions */}
        <div className="flex flex-col items-center p-6 bg-gray-50 rounded-xl border border-gray-100 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Payment Instruction</span>
          <h3 className="text-base font-bold text-gray-900 mb-3">Scan to Pay</h3>
          <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 mb-3">
            <img
              src="/images/payment-qr.svg"
              alt="BuildMate Payment QR"
              width={200}
              height={200}
              className="rounded"
            />
          </div>
          <p className="text-xs text-gray-600 mb-4 font-medium">
            After completing payment, upload your payment proof.
          </p>

          <div className="w-full space-y-2">
            <div className="flex justify-between items-center text-xs py-1 border-b border-gray-200">
              <span className="text-gray-500">Amount Due:</span>
              <span className="font-bold text-gray-900 text-base">₹{expectedAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs py-1 border-b border-gray-200">
              <span className="text-gray-500">UPI ID:</span>
              <span className="font-mono font-bold text-blue-600 select-all">buildmate@bank</span>
            </div>
            {advancePaymentDeadline && (
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-gray-500">Deadline:</span>
                <span className="text-gray-700 font-medium">
                  {new Date(advancePaymentDeadline).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg">
              {successMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Transaction Reference / UTR Number *
            </label>
            <input
              type="text"
              required
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. UPI Ref / 12-digit UTR: 423982938120"
              className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              Found on your banking/UPI payment confirmation screen.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Payment Screenshot / Receipt *
            </label>
            <input
              type="file"
              required
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="w-full text-xs p-2 border border-gray-300 rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              PNG, JPG, or WebP up to 5 MB.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting || !file || !transactionRef.trim()}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shadow-sm"
          >
            {submitting ? "Uploading & Submitting..." : "Submit Payment Proof"}
          </button>
        </form>
      </div>
    </div>
  );
}
