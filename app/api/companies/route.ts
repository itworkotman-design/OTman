import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";

// Lightweight cross-tenant company listing — used to populate the store
// multi-select on the pickup-addresses settings page. No other admin page
// needs to list companies across tenants, so this stays intentionally small.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);
  const auth = await requireFullAccessMembership(session);

  if (!auth.ok) return auth.response;

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ ok: true, companies });
}
