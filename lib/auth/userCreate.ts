import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/auth/membership";
import { hashPassword } from "@/lib/auth/password";

type AppPermission = "BOOKING_VIEW" | "BOOKING_CREATE";

type CreateUserResult =
  | {
      ok: true;
      userId: string;
      membershipId: string;
    }
  | {
      ok: false;
      reason:
        | "INVALID_INPUT"
        | "FORBIDDEN"
        | "EMAIL_ALREADY_EXISTS"
        | "EMAIL_ALREADY_MEMBER";
    };

const ALLOWED_ROLES = new Set<Role>(["OWNER", "ADMIN", "USER"]);

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePermissions(
  value: AppPermission[] | undefined,
): AppPermission[] {
  const list = Array.isArray(value) ? value : [];

  const filtered = list.filter(
    (permission): permission is AppPermission =>
      permission === "BOOKING_VIEW" || permission === "BOOKING_CREATE",
  );

  const withDependencies = filtered.includes("BOOKING_CREATE")
    ? ["BOOKING_VIEW", ...filtered]
    : filtered;

  return Array.from(new Set(withDependencies)) as AppPermission[];
}

export async function createUserWithPassword(params: {
  actorUserId: string;
  companyId: string;
  email: string;
  role: string;
  password: string;
  username?: string | null;
  warehouseEmail?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  description?: string | null;
  logoPath?: string | null;
  usernameDisplayColor?: string | null;
  priceListId?: string | null;
  permissions?: AppPermission[];
}): Promise<CreateUserResult> {
  const email = params.email.trim().toLowerCase();
  const companyId = params.companyId.trim();
  const nextRole = params.role.trim() as Role;
  const password = params.password;

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
    !ALLOWED_ROLES.has(nextRole) ||
    password.trim().length < 8
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

  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      const existingMembership = await tx.membership.findUnique({
        where: {
          userId_companyId: {
            userId: existingUser.id,
            companyId,
          },
        },
        select: { id: true },
      });

      if (existingMembership) {
        return { ok: false as const, reason: "EMAIL_ALREADY_MEMBER" as const };
      }

      return { ok: false as const, reason: "EMAIL_ALREADY_EXISTS" as const };
    }

    const user = await tx.user.create({
      data: {
        email,
        username,
        phoneNumber,
        address,
        description,
        logoPath,
        usernameDisplayColor,
        passwordHash,
        status: "ACTIVE",
      },
      select: { id: true },
    });

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

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        companyId,
        role: nextRole,
        status: "ACTIVE",
        priceListId,
        warehouseEmail,
      },
      select: { id: true },
    });

    if (permissions.length > 0) {
      await tx.membershipPermission.createMany({
        data: permissions.map((permission) => ({
          membershipId: membership.id,
          permission,
        })),
      });
    }

    return {
      ok: true as const,
      userId: user.id,
      membershipId: membership.id,
    };
  });
}
