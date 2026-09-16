import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";

// Lightweight cross-tenant user listing — used to populate the
// per-user visibility multi-select on the pickup-addresses settings page.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);
  const auth = await requireFullAccessMembership(session);

  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      username: true,
      mainPickupAddress: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ ok: true, users });
}
