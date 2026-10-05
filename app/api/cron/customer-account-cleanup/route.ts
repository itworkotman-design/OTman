import { NextResponse } from "next/server";
import { runCustomerAccountCleanup } from "@/lib/customerAccounts/runCustomerAccountCleanup";

// Deletes temporary customer ("My order") accounts that are no longer needed
// — see lib/customerAccounts/accountLifetime.ts. The grace period is one day,
// so schedule this hourly.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await runCustomerAccountCleanup();
  return NextResponse.json({ ok: true, ...summary });
}
