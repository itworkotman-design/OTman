import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const lastChecked =
    typeof body?.lastChecked === "string" ? body.lastChecked : null;
  // The Website orders page only cares about homepage orders; without this a
  // B2B order elsewhere in the company would flag its Refresh button.
  const websiteOrdersOnly = body?.websiteOrdersOnly === true;
  const companyId = session.activeCompanyId;

  let hasNewOrders = false;
  let hasChangedOrders = false;

  if (lastChecked && companyId) {
    const since = new Date(lastChecked);
    if (!isNaN(since.getTime())) {
      const [newCount, changedCount] = await Promise.all([
        prisma.order.count({
          where: {
            companyId,
            ...(websiteOrdersOnly ? { isWebsiteOrder: true } : {}),
            createdAt: { gt: since },
          },
        }),
        prisma.order.count({
          where: {
            companyId,
            ...(websiteOrdersOnly ? { isWebsiteOrder: true } : {}),
            updatedAt: { gt: since },
            createdAt: { lte: since },
          },
        }),
      ]);
      hasNewOrders = newCount > 0;
      hasChangedOrders = changedCount > 0;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      now: new Date().toISOString(),
      hasNewOrders,
      hasChangedOrders,
    },
    { status: 200 },
  );
}
