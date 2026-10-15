import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Manual payment proof uploads are deprecated. Payments are now processed via automated Razorpay Standard Checkout.",
    },
    { status: 410 }
  );
}
