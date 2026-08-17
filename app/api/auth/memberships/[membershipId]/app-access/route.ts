import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { isUserManagementAdmin } from "@/lib/users/access";
import {
  normalizeAppAccessInput,
  derivePermissionsFromAppAccess,
  isAppAccessGrantAllowedForNonOwner,
} from "@/lib/users/appAccessDefaults";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const actorMembership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!actorMembership || !isUserManagementAdmin(actorMembership)) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const { membershipId } = await params;
  const body = await req.json().catch(() => null);
  const appAccess = normalizeAppAccessInput(body?.appAccess);

  if (!appAccess) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const targetMembership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: {
      id: true,
      role: true,
      status: true,
      companyId: true,
      userId: true,
      appAccess: {
        where: { module: "USER_MANAGEMENT" },
        select: { enabled: true, level: true },
      },
    },
  });

  if (
    !targetMembership ||
    targetMembership.companyId !== session.activeCompanyId ||
    targetMembership.status !== "ACTIVE"
  ) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const isOwner = actorMembership.role === "OWNER";
  const canEditTarget = isOwner || targetMembership.role === "USER";

  if (!canEditTarget) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  // A non-owner USER_MANAGEMENT/Admin can hand out Viewer-level grants (and
  // either Booking level) but can never escalate anyone to Admin on another
  // module, and can never touch this target's USER_MANAGEMENT row at all —
  // only an Owner grants/revokes who else gets to manage users.
  if (!isOwner && !isAppAccessGrantAllowedForNonOwner(appAccess, targetMembership.appAccess[0])) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  // Since a module can now be disabled even for OWNER/ADMIN, nothing else
  // stops a company from locking itself out of ever re-enabling anything —
  // block the change if it would leave zero people with USER_MANAGEMENT
  // admin access, mirroring the existing last-owner protections on the
  // role-change/disable endpoints.
  const targetUserManagement = appAccess.find((a) => a.module === "USER_MANAGEMENT")!;
  const targetKeepsUserManagementAdmin =
    targetUserManagement.enabled && targetUserManagement.level === "ADMIN";

  if (!targetKeepsUserManagementAdmin) {
    const otherAdminCount = await prisma.membershipAppAccess.count({
      where: {
        module: "USER_MANAGEMENT",
        enabled: true,
        level: "ADMIN",
        membershipId: { not: targetMembership.id },
        membership: {
          companyId: targetMembership.companyId,
          status: "ACTIVE",
        },
      },
    });

    if (otherAdminCount === 0) {
      return NextResponse.json(
        { ok: false, reason: "CANNOT_REMOVE_LAST_USER_MANAGEMENT_ADMIN" },
        { status: 400 },
      );
    }
  }

  const permissions = derivePermissionsFromAppAccess(appAccess);

  await prisma.$transaction(async (tx) => {
    for (const row of appAccess) {
      await tx.membershipAppAccess.upsert({
        where: { membershipId_module: { membershipId: targetMembership.id, module: row.module } },
        create: { membershipId: targetMembership.id, module: row.module, enabled: row.enabled, level: row.level },
        update: { enabled: row.enabled, level: row.level },
      });
    }

    await tx.membershipPermission.deleteMany({
      where: { membershipId: targetMembership.id },
    });

    if (permissions.length > 0) {
      await tx.membershipPermission.createMany({
        data: permissions.map((permission) => ({
          membershipId: targetMembership.id,
          permission,
        })),
      });
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
