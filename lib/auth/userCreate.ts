import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/auth/membership";
import { hashPassword } from "@/lib/auth/password";
import {
  defaultAppAccessRows,
  normalizeAppAccessInput,
  derivePermissionsFromAppAccess,
  isAppAccessGrantAllowedForNonOwner,
} from "@/lib/users/appAccessDefaults";
import { normalizeDashboardSectionsInput } from "@/lib/users/dashboardSections";
import { isUserManagementAdmin } from "@/lib/users/access";

type AppPermission = "BOOKING_VIEW" | "BOOKING_CREATE" | "ARCHIVE_VIEW";

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
      permission === "BOOKING_VIEW" ||
      permission === "BOOKING_CREATE" ||
      permission === "ARCHIVE_VIEW",
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
  priceListIds?: string[];
  permissions?: AppPermission[];
  appAccess?: unknown;
  dashboardSections?: unknown;
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
  const priceListIds = Array.isArray(params.priceListIds) ? params.priceListIds.filter(Boolean) : [];

  // The Edit/Add User modal submits the full per-module access matrix
  // directly — when present, it's the source of truth and legacy
  // permissions are derived from it. Callers that don't pass it (older
  // integrations, tests) fall back to the previous role/permission-derived
  // defaults.
  const explicitAppAccess = normalizeAppAccessInput(params.appAccess);
  const permissions = explicitAppAccess
    ? derivePermissionsFromAppAccess(explicitAppAccess)
    : normalizePermissions(params.permissions);

  // Optional — omitted entirely means "use the default (all visible)",
  // matching MembershipDashboardSection's missing-row-means-visible
  // semantics. Only an Owner may set it (checked once actorMembership is
  // known, below).
  let dashboardSections: ReturnType<typeof normalizeDashboardSectionsInput> = null;
  if (params.dashboardSections !== undefined) {
    dashboardSections = normalizeDashboardSectionsInput(params.dashboardSections);
    if (!dashboardSections) {
      return { ok: false, reason: "INVALID_INPUT" };
    }
  }

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

  if (!actorMembership || !isUserManagementAdmin(actorMembership)) {
    return { ok: false, reason: "FORBIDDEN" };
  }

  // Only an Owner can create another Owner or Admin, or grant Admin-level
  // access on any module besides Booking, or grant USER_MANAGEMENT at all —
  // a non-owner USER_MANAGEMENT/Admin can only ever create plain USER-role
  // people with Viewer-level (or Booking) grants.
  const appAccessToWrite = explicitAppAccess ?? defaultAppAccessRows(nextRole, permissions);

  if (actorMembership.role !== "OWNER") {
    if (nextRole !== "USER" || !isAppAccessGrantAllowedForNonOwner(appAccessToWrite)) {
      return { ok: false, reason: "FORBIDDEN" };
    }
  }

  if (priceListIds.length > 0) {
    const foundLists = await prisma.priceList.findMany({
      where: { id: { in: priceListIds } },
      select: { id: true },
    });

    if (foundLists.length !== priceListIds.length) {
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
        warehouseEmail,
      },
      select: { id: true },
    });

    if (priceListIds.length > 0) {
      await tx.membershipPriceList.createMany({
        data: priceListIds.map((priceListId) => ({
          membershipId: membership.id,
          priceListId,
        })),
      });
    }

    if (permissions.length > 0) {
      await tx.membershipPermission.createMany({
        data: permissions.map((permission) => ({
          membershipId: membership.id,
          permission,
        })),
      });
    }

    await tx.membershipAppAccess.createMany({
      data: appAccessToWrite.map((row) => ({
        membershipId: membership.id,
        ...row,
      })),
    });

    if (dashboardSections && actorMembership.role === "OWNER") {
      await tx.membershipDashboardSection.createMany({
        data: dashboardSections.map((row) => ({
          membershipId: membership.id,
          ...row,
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
