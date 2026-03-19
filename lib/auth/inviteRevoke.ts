import { AuthEventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/auth/membership";
import { logAuthEvent } from "@/lib/auth/authEvent";

type RevokeInviteResult =
  | { ok: true }
  | { ok: false; reason: "INVITE_NOT_FOUND" | "FORBIDDEN" };

export async function revokeInvite(params: {
  actorUserId: string;
  inviteId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<RevokeInviteResult> {
  const inviteId = params.inviteId.trim();

  if (!params.actorUserId || !inviteId) {
    return { ok: false, reason: "INVITE_NOT_FOUND" };
  }

  const targetInvite = await prisma.invite.findUnique({
    where: {
      id: inviteId,
    },
    select: {
      id: true,
      companyId: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!targetInvite || targetInvite.status !== "PENDING") {
    return { ok: false, reason: "INVITE_NOT_FOUND" };
  }

  const actorMembership = await getActiveMembership({
    userId: params.actorUserId,
    companyId: targetInvite.companyId,
  });

  if (!actorMembership || actorMembership.role === "USER") {
    return { ok: false, reason: "FORBIDDEN" };
  }

  if (actorMembership.role === "ADMIN" && targetInvite.role === "OWNER") {
    return { ok: false, reason: "FORBIDDEN" };
  }

  await prisma.invite.updateMany({
    where: {
      id: targetInvite.id,
      status: "PENDING",
    },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });

  await logAuthEvent({
    type: AuthEventType.INVITE_REVOKED,
    userId: params.actorUserId,
    companyId: targetInvite.companyId,
    email: targetInvite.email,
    ip: params.ip,
    userAgent: params.userAgent,
    meta: {
      inviteId: targetInvite.id,
      role: targetInvite.role,
      actorUserId: params.actorUserId,
    },
  });

  return { ok: true };
}
