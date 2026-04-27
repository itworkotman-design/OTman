import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { prisma } from "@/lib/db";
import {
  isManagedUserLogoPath,
  normalizeUserLogoPath,
  normalizeUsernameDisplayColor,
} from "@/lib/users/profileAppearance";

type AppPermission = "BOOKING_VIEW" | "BOOKING_CREATE";

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function parsePermissions(value: unknown): AppPermission[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (permission: unknown): permission is AppPermission =>
      permission === "BOOKING_VIEW" || permission === "BOOKING_CREATE"
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 }
    );
  }

  const actorMembership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
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

  const { membershipId } = await params;
  const body = await req.json().catch(() => null);

  const username = parseOptionalString(body?.username);
  const email = parseEmail(body?.email);
  const warehouseEmail =
    body?.warehouseEmail === "" ? null : parseEmail(body?.warehouseEmail);
  const phoneNumber = parseOptionalString(body?.phoneNumber);
  const address = parseOptionalString(body?.address);
  const description = parseOptionalString(body?.description);
  const logoPath = normalizeUserLogoPath(
    typeof body?.logoPath === "string" ? body.logoPath : null,
  );
  const usernameDisplayColor = normalizeUsernameDisplayColor(
    typeof body?.usernameDisplayColor === "string"
      ? body.usernameDisplayColor
      : null,
  );
  const priceListId =
    typeof body?.priceListId === "string" && body.priceListId.trim()
      ? body.priceListId.trim()
      : null;
  const permissions = parsePermissions(body?.permissions);

  if (!email) {
    return NextResponse.json(
      { ok: false, reason: "EMAIL_REQUIRED" },
      { status: 400 }
    );
  }

  const normalizedPermissions = permissions.includes("BOOKING_CREATE")
    ? (["BOOKING_VIEW", ...permissions] as AppPermission[])
    : permissions;

  const uniquePermissions = Array.from(
    new Set(normalizedPermissions)
  ) as AppPermission[];

  const targetMembership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: {
      id: true,
      role: true,
      status: true,
      companyId: true,
      userId: true,
    },
  });

  if (
    !targetMembership ||
    targetMembership.companyId !== session.activeCompanyId ||
    targetMembership.status !== "ACTIVE"
  ) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const canEditTarget =
    actorMembership.role === "OWNER" ||
    (actorMembership.role === "ADMIN" && targetMembership.role === "USER");

  if (!canEditTarget) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const previousUser = await prisma.user.findUnique({
      where: { id: targetMembership.userId },
      select: {
        logoPath: true,
      },
    });

    const user = await prisma.user.update({
      where: { id: targetMembership.userId },
      data: {
        email,
        username,
        phoneNumber,
        address,
        description,
        logoPath,
        usernameDisplayColor,
      },
      select: {
        id: true,
        email: true,
        username: true,
        phoneNumber: true,
        address: true,
        description: true,
        logoPath: true,
        usernameDisplayColor: true,
        status: true,
      },
    });

    const previousLogoPath = previousUser?.logoPath ?? null;

    if (
      previousLogoPath &&
      isManagedUserLogoPath(previousLogoPath) &&
      previousLogoPath !== user.logoPath
    ) {
      const absolutePath = path.join(
        process.cwd(),
        "public",
        previousLogoPath.replace(/^\//, ""),
      );

      unlink(absolutePath).catch(() => {});
    }

    await prisma.membership.update({
      where: { id: targetMembership.id },
      data: {
        priceListId,
        warehouseEmail,
      },
    });
    
    await prisma.membershipPermission.deleteMany({
      where: {
        membershipId: targetMembership.id,
      },
    });

    if (uniquePermissions.length > 0) {
      await prisma.membershipPermission.createMany({
        data: uniquePermissions.map((permission) => ({
          membershipId: targetMembership.id,
          permission,
        })),
      });
    }

    return NextResponse.json({ ok: true, user }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "UPDATE_FAILED" },
      { status: 400 }
    );
  }
}
