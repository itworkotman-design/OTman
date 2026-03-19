import { AuthEventType, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/auth/membership";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { generateInviteToken, hashInviteToken } from "@/lib/auth/inviteToken";
import { deliverInvite } from "@/lib/auth/inviteDelivery";

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CreateInviteResult =
  | { ok: true }
  | { ok: false; reason: "INVALID_INPUT" | "FORBIDDEN" };

const ALLOWED_ROLES = new Set<Role>(["OWNER", "ADMIN", "USER"]);

export async function createInvite(params: {
  actorUserId: string;
  companyId: string;
  email: string;
  role: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<CreateInviteResult> {
  const email = params.email.trim().toLowerCase();
  const nextRole = params.role.trim() as Role;
  const companyId = params.companyId.trim();

  if (!params.actorUserId || !companyId || !email || !ALLOWED_ROLES.has(nextRole)) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  const actorMembership = await getActiveMembership({
    userId: params.actorUserId,
    companyId,
  });

  if (!actorMembership || actorMembership.role === "USER") {
    return { ok: false, reason: "FORBIDDEN" };
  }

  if (actorMembership.role === "ADMIN" && nextRole === "OWNER") {
    return { ok: false, reason: "FORBIDDEN" };
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.invite.updateMany({
      where: {
        companyId,
        email,
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    await tx.invite.create({
      data: {
        companyId,
        email,
        role: nextRole,
        status: "PENDING",
        tokenHash,
        expiresAt,
        createdByUserId: params.actorUserId,
      },
    });
  });

  await deliverInvite({
    email,
    token,
  });

  await logAuthEvent({
    type: AuthEventType.INVITE_SENT,
    userId: params.actorUserId,
    companyId,
    email,
    ip: params.ip,
    userAgent: params.userAgent,
    meta: {
      invitedEmail: email,
      role: nextRole,
    },
  });

  return { ok: true };
}
