import { NextResponse } from "next/server";
import { AuthEventType } from "@prisma/client";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);

  const companyId =
    typeof body?.companyId === "string" ? body.companyId.trim() : "";

  if (!companyId) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_COMPANY_ID" },
      { status: 400 }
    );
  }

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId,
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "MEMBERSHIP_NOT_FOUND" },
      { status: 404 }
    );
  }

  await prisma.membership.updateMany({
    where: {
      userId: session.userId,
      companyId,
      status: "ACTIVE",
    },
    data: {
      status: "DISABLED",
    },
  });

  await logAuthEvent({
    type: AuthEventType.MEMBERSHIP_DISABLED,
    userId: session.userId,
    companyId,
    meta: {
      disabledUserId: session.userId,
      companyId,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}