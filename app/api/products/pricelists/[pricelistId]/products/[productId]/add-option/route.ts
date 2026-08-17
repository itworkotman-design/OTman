import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  // Returns every active price list's id/name/code — purely editor tooling
  // ("copy option from another price list"), not used by the read-only
  // Price lists page, so it's Owner/Admin only like the rest of editPrices.
  const gate = await requireFullAccessMembership(session);
  if (!gate.ok) return gate.response;

  const priceLists = await prisma.priceList.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json(
    {
      ok: true,
      priceLists,
    },
    { status: 200 },
  );
}
