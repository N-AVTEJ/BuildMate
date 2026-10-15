import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Manual payment rejection is deprecated. Payments are automatically verified via Razorpay signature verification.",
    },
    { status: 410 }
  );
}
