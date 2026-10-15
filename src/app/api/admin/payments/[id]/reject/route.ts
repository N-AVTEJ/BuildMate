import { NextResponse } from "next/server";

export async function POST(_req?: Request, ..._rest: any[]) {
  return NextResponse.json(
    {
      error:
        "Manual payment rejection is deprecated. Payments are automatically verified via Razorpay signature verification.",
    },
    { status: 410 }
  );
}
