import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Manual payment verification is deprecated. Payments are automatically verified via Razorpay webhook/signature verification.",
    },
    { status: 410 }
  );
}
