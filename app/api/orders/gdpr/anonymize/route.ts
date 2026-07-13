import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { parseGdprLimitParam, runGdprCleanup } from "@/lib/gdpr/runGdprCleanup";

// Manual "run now" trigger for the same GDPR retention sweep the daily cron
// (app/api/cron/gdpr-cleanup/route.ts) runs — scoped to the caller's active
// company, mirroring the generateDueOccurrences()/generate-now relationship
// used for scheduler orders. There is only one cleanup code path.
export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      role: true,
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const limit = parseGdprLimitParam(new URL(req.url).searchParams);
  const summary = await runGdprCleanup({ companyId: session.activeCompanyId, limit });

  return NextResponse.json({ ok: true, ...summary });
}
