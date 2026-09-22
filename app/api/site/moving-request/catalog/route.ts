import { NextResponse } from "next/server";
import { getMovingCatalog } from "@/lib/content/getMovingCatalog";

// Public, unauthenticated pricing fetch for the Moving quote-request flow's
// size-bracket picker. Deliberately its own small route, not the generic
// /api/booking/catalog (env-gated to exactly one public price list) or
// lib/booking/catalog/getBookingCatalog (returns every product in the DB,
// unscoped) — see getMovingCatalog for the query itself, shared with the
// submission route's server-side price re-resolution.
export async function GET() {
  const catalog = await getMovingCatalog();

  if (!catalog) {
    return NextResponse.json({ ok: false, reason: "NOT_SEEDED" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, priceListId: catalog.priceListId, options: catalog.options }, { status: 200 });
}
