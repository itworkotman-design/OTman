import { NextResponse } from "next/server";
import { runNeedsChangeNoReplySweep } from "@/lib/orders/alerts/needsChangeNoReplySweep";

// Daily: alerts staff about "needs change" website orders that reached their
// delivery date without the customer answering. See
// lib/orders/alerts/needsChangeNoReplySweep.ts.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
  const summary = await runNeedsChangeNoReplySweep({ limit });

  return NextResponse.json({ ok: true, ...summary });
}
