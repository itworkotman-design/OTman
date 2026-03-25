import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

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
