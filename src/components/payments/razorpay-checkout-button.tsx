"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

interface RazorpayCheckoutButtonProps {
  projectId: string;
  projectCode: string;
  paymentType: "ADVANCE" | "FINAL";
  amount?: number;
  expectedAmount?: number;
  advancePaymentDeadline?: string | null;
  rejectionReason?: string | null;
}

export function RazorpayCheckoutButton(props: RazorpayCheckoutButtonProps) {
  const {
    projectId,
    projectCode,
    paymentType,
    advancePaymentDeadline,
    rejectionReason,
  } = props;
  const amount = props.amount ?? props.expectedAmount ?? 0;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const handlePayment = async () => {
    setError(null);
    setLoading(true);

    try {
      // 1. Create order on server (server determines amount)
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate payment order.");
      }

      if (typeof window === "undefined" || !(window as any).Razorpay) {
        throw new Error(
          "Razorpay Checkout SDK is still loading. Please wait 2 seconds and try again."
        );
      }

      // 2. Open Razorpay Standard Checkout Modal
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "BuildMate",
        description: `${paymentType} payment for ${projectCode}`,
        order_id: data.order_id,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          setLoading(false);
          setVerifying(true);

          try {
            // 3. Cryptographically verify signature on server
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(
                verifyData.error ||
                  "Payment signature verification failed. Please contact support."
              );
            }

            setSuccess(true);
            setTimeout(() => {
              router.refresh();
            }, 1200);
          } catch (vErr: any) {
            setError(vErr.message || "Payment verification failed.");
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            console.log("[Razorpay] Payment modal dismissed by user.");
          },
        },
        prefill: {
          name: "BuildMate Client",
        },
        theme: {
          color: "#171e19",
        },
      };

      const rzp = new (window as any).Razorpay(options);

      rzp.on("payment.failed", (resp: any) => {
        setLoading(false);
        setError(
          resp.error?.description ||
            resp.error?.reason ||
            "Payment failed. Please choose another payment method."
        );
      });

      rzp.open();
    } catch (err: any) {
      console.error("[RazorpayCheckout] Error:", err);
      setError(err.message || "Failed to start payment.");
      setLoading(false);
    }
  };

  const isAdvance = paymentType === "ADVANCE";
  const title = isAdvance ? "Advance Milestone Deposit" : "Final Delivery Payment";
  const buttonLabel = isAdvance
    ? `Pay Advance ₹${amount.toLocaleString()}`
    : `Pay Remaining ₹${amount.toLocaleString()}`;

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="space-y-6">
        {/* Title & Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#ffe17c] border border-black text-[10px] font-heading font-black tracking-wider uppercase mb-1">
              ⚡ Razorpay Instant Escrow
            </div>
            <h3 className="font-heading font-black text-2xl text-black">{title}</h3>
            <p className="text-xs text-black/70 font-semibold mt-0.5">
              {isAdvance
                ? "Secure milestone escrow to lock development scope and initiate project."
                : "Final milestone payment to unlock full GitHub repository delivery."}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-black/60 block">
              Amount Due
            </span>
            <span className="font-heading font-black text-3xl text-black">
              ₹{amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Previous Rejection Banner */}
        {rejectionReason && (
          <div className="bg-rose-100 border-2 border-black rounded-xl p-4 text-xs font-semibold text-rose-900 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-heading font-black text-sm text-black">
                Previous Transaction Issue
              </p>
              <p className="mt-0.5">{rejectionReason}</p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-100 border-2 border-black rounded-xl p-4 text-xs font-semibold text-rose-900 flex items-start gap-3">
            <span className="text-xl">❌</span>
            <div>
              <p className="font-heading font-black text-sm text-black">
                Payment Unsuccessful
              </p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {success && (
          <div className="bg-emerald-100 border-2 border-black rounded-xl p-4 text-xs font-semibold text-emerald-900 flex items-start gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="font-heading font-black text-sm text-black">
                Payment Verified Successfully!
              </p>
              <p className="mt-0.5">
                Cryptographic signature verified. Refreshing project status...
              </p>
            </div>
          </div>
        )}

        {/* Payment Features Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#fffdf0] p-4 rounded-xl border-2 border-black text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <div>
              <p className="font-heading font-bold text-black">Escrow Protected</p>
              <p className="text-[10px] text-black/60">Released only on gates</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base">💳</span>
            <div>
              <p className="font-heading font-bold text-black">Cards, UPI & Netbanking</p>
              <p className="text-[10px] text-black/60">Standard Razorpay Gateway</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <div>
              <p className="font-heading font-bold text-black">Instant Verification</p>
              <p className="text-[10px] text-black/60">No manual screenshot reviews</p>
            </div>
          </div>
        </div>

        {advancePaymentDeadline && isAdvance && (
          <p className="text-xs font-bold text-black/70">
            Payment Deadline:{" "}
            <span className="text-black font-black">
              {new Date(advancePaymentDeadline).toLocaleString()}
            </span>
          </p>
        )}

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={handlePayment}
            disabled={loading || verifying || success}
            className="w-full neo-btn py-4 px-6 bg-[#ffe17c] hover:bg-[#ffd644] text-black font-heading font-black text-base uppercase tracking-wider rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {verifying ? (
              <>
                <span className="animate-spin text-lg">⏳</span>
                Verifying Cryptographic Signature...
              </>
            ) : loading ? (
              <>
                <span className="animate-spin text-lg">🌀</span>
                Opening Razorpay Gateway...
              </>
            ) : (
              <>
                <span>💳</span>
                {buttonLabel}
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-black/50 font-bold mt-2">
            Test mode enabled. You can use Razorpay test card or test UPI.
          </p>
        </div>
      </div>
    </>
  );
}
