import { NextResponse } from "next/server";
import { parsePaymentTimeoutLimitParam, runPaymentTimeoutSweep } from "@/lib/orders/paymentTimeout/runPaymentTimeoutSweep";

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const limit = parsePaymentTimeoutLimitParam(new URL(req.url).searchParams);
  const summary = await runPaymentTimeoutSweep({ limit });

  return NextResponse.json({ ok: true, ...summary });
}
