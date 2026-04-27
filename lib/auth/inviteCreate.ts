// lib/auth/inviteCreate.ts
import { AuthEventType, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/auth/membership";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { generateInviteToken, hashInviteToken } from "@/lib/auth/inviteToken";
import { deliverInvite } from "@/lib/auth/inviteDelivery";

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AppPermission = "BOOKING_VIEW" | "BOOKING_CREATE";

type CreateInviteResult =
  | { ok: true }
  | { ok: false; reason: "INVALID_INPUT" | "FORBIDDEN" };

const ALLOWED_ROLES = new Set<Role>(["OWNER", "ADMIN", "USER"]);

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePermissions(
  value: AppPermission[] | undefined,
): AppPermission[] {
  const list = Array.isArray(value) ? value : [];

  const filtered: AppPermission[] = list.filter(
    (permission): permission is AppPermission =>
      permission === "BOOKING_VIEW" || permission === "BOOKING_CREATE",
  );

  const withDependencies: AppPermission[] = filtered.includes("BOOKING_CREATE")
    ? ["BOOKING_VIEW", ...filtered]
    : filtered;

  return Array.from(new Set(withDependencies)) as AppPermission[];
}

export async function createInvite(params: {
  actorUserId: string;
  companyId: string;
  email: string;
  role: string;
  username?: string | null;
  warehouseEmail?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  description?: string | null;
  logoPath?: string | null;
  usernameDisplayColor?: string | null;
  priceListId?: string | null;
  permissions?: AppPermission[];
  ip?: string | null;
  userAgent?: string | null;
}): Promise<CreateInviteResult> {
  const email = params.email.trim().toLowerCase();
  const nextRole = params.role.trim() as Role;
  const companyId = params.companyId.trim();

  const username = normalizeOptionalString(params.username);
  const warehouseEmail = normalizeOptionalString(params.warehouseEmail);
  const phoneNumber = normalizeOptionalString(params.phoneNumber);
  const address = normalizeOptionalString(params.address);
  const description = normalizeOptionalString(params.description);
  const logoPath = normalizeOptionalString(params.logoPath);
  const usernameDisplayColor = normalizeOptionalString(
    params.usernameDisplayColor,
  );
  const priceListId = normalizeOptionalString(params.priceListId);
  const permissions = normalizePermissions(params.permissions);

  if (
    !params.actorUserId ||
    !companyId ||
    !email ||
    !ALLOWED_ROLES.has(nextRole)
  ) {
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

  if (priceListId) {
    const priceList = await prisma.priceList.findUnique({
      where: { id: priceListId },
      select: { id: true },
    });

    if (!priceList) {
      return { ok: false, reason: "INVALID_INPUT" };
    }
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

    const invite = await tx.invite.create({
      data: {
        companyId,
        email,
        role: nextRole,
        username,
        warehouseEmail,
        phoneNumber,
        address,
        description,
        logoPath,
        usernameDisplayColor,
        priceListId,
        status: "PENDING",
        tokenHash,
        expiresAt,
        createdByUserId: params.actorUserId,
      },
      select: {
        id: true,
      },
    });

    if (permissions.length > 0) {
      await tx.invitePermission.createMany({
        data: permissions.map((permission) => ({
          inviteId: invite.id,
          permission,
        })),
      });
    }
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
      username,
      warehouseEmail,
      phoneNumber,
      address,
      logoPath,
      usernameDisplayColor,
      priceListId,
      permissions,
    },
  });

  return { ok: true };
}
