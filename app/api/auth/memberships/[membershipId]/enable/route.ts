import { NextResponse } from "next/server";
import { AuthEventType } from "@prisma/client";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  context: { params: Promise<{ membershipId: string }> }
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { membershipId } = await context.params;

  const targetMembershipId =
    typeof membershipId === "string" ? membershipId.trim() : "";

  if (!targetMembershipId) {
    return NextResponse.json(
      { ok: false, reason: "MEMBERSHIP_NOT_FOUND" },
      { status: 404 }
    );
  }

  const targetMembership = await prisma.membership.findUnique({
    where: {
      id: targetMembershipId,
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      role: true,
      status: true,
    },
  });

  if (!targetMembership || targetMembership.status !== "DISABLED") {
    return NextResponse.json(
      { ok: false, reason: "MEMBERSHIP_NOT_FOUND" },
      { status: 404 }
    );
  }

  const actorMembership = await getActiveMembership({
    userId: session.userId,
    companyId: targetMembership.companyId,
  });

  if (
    !actorMembership ||
    (actorMembership.role !== "OWNER" && actorMembership.role !== "ADMIN")
  ) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 }
    );
  }

  await prisma.membership.updateMany({
    where: {
      id: targetMembership.id,
      status: "DISABLED",
    },
    data: {
      status: "ACTIVE",
    },
  });

  await logAuthEvent({
    type: AuthEventType.MEMBERSHIP_ENABLED,
    userId: targetMembership.userId,
    companyId: targetMembership.companyId,
    meta: {
      enabledMembershipId: targetMembership.id,
      actorUserId: session.userId,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
