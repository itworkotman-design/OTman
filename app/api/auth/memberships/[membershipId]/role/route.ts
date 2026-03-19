import { NextResponse } from "next/server";
import { AuthEventType } from "@prisma/client";
import {
  getAuthenticatedSession,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { prisma } from "@/lib/db";

const ALLOWED_ROLES = new Set(["OWNER", "ADMIN", "USER"]);

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

  if (!targetMembership || targetMembership.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, reason: "MEMBERSHIP_NOT_FOUND" },
      { status: 404 }
    );
  }

  const actorMembership = await getActiveMembership({
    userId: session.userId,
    companyId: targetMembership.companyId,
  });

  if (!actorMembership || actorMembership.role === "USER") {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);

  const nextRole = typeof body?.role === "string" ? body.role.trim() : "";

  if (!ALLOWED_ROLES.has(nextRole)) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ROLE" },
      { status: 400 }
    );
  }

  if (actorMembership.role === "ADMIN") {
    if (targetMembership.role !== "USER" || nextRole === "OWNER") {
      return NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 }
      );
    }
  }

  if (targetMembership.role === "OWNER" && nextRole !== "OWNER") {
    const activeOwnerCount = await prisma.membership.count({
      where: {
        companyId: targetMembership.companyId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    if (activeOwnerCount <= 1) {
      return NextResponse.json(
        { ok: false, reason: "CANNOT_CHANGE_LAST_OWNER" },
        { status: 400 }
      );
    }
  }

  await prisma.membership.updateMany({
    where: {
      id: targetMembership.id,
      status: "ACTIVE",
    },
    data: {
      role: nextRole,
    },
  });

  await revokeAllUserSessions(targetMembership.userId);

  await logAuthEvent({
    type: AuthEventType.MEMBERSHIP_ROLE_CHANGED,
    userId: targetMembership.userId,
    companyId: targetMembership.companyId,
    meta: {
      membershipId: targetMembership.id,
      previousRole: targetMembership.role,
      newRole: nextRole,
      actorUserId: session.userId,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}