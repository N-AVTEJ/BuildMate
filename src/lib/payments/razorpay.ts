import Razorpay from "razorpay";

export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET) are missing.");
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
}

export interface CreateOrderParams {
  amount: number; // in paise
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
  notes?: Record<string, any>;
}

/**
 * Resilient Razorpay Order Creator using native fetch with timeouts, retries,
 * and clean error handling (avoiding axios normalizeError undefined crashes).
 */
export async function createRazorpayOrder(
  params: CreateOrderParams
): Promise<RazorpayOrderResult> {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET) are missing.");
  }

  const auth = Buffer.from(`${key_id}:${key_secret}`).toString("base64");
  const url = "https://api.razorpay.com/v1/orders";
  const payload = {
    amount: params.amount,
    currency: params.currency || "INR",
    receipt: params.receipt,
    notes: params.notes,
  };

  let lastError: any = null;

  // Retry up to 2 times on transient network drops
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12-second timeout

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = await res.json();

      if (!res.ok) {
        const errorDesc =
          data?.error?.description ||
          data?.error?.reason ||
          `Payment gateway rejected order creation (HTTP ${res.status}).`;
        const err = new Error(errorDesc) as any;
        err.statusCode = res.status;
        err.error = data?.error;
        throw err;
      }

      return data as RazorpayOrderResult;
    } catch (err: any) {
      lastError = err;

      // Do NOT retry client-side/auth 4xx errors
      if (err?.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
        throw err;
      }

      if (attempt < 2) {
        // Wait 800ms before retry on network/socket disconnect
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  const isTimeout = lastError?.name === "AbortError";
  const friendlyMsg = isTimeout
    ? "Payment gateway connection timed out. Please check your internet connection and try again."
    : lastError?.message || "Failed to communicate with Razorpay payment gateway.";

  const finalError = new Error(friendlyMsg) as any;
  finalError.statusCode = lastError?.statusCode || 500;
  throw finalError;
}
