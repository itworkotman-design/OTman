import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { isUserManagementAdmin } from "@/lib/users/access";
import { prisma } from "@/lib/db";
import {
  deleteAttachmentFromS3,
  isS3StoragePath,
} from "@/lib/orders/orderAttachmentStorage";
import {
  isManagedUserLogoPath,
  normalizeUserLogoPath,
  normalizeUsernameDisplayColor,
} from "@/lib/users/profileAppearance";

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

  if (!actorMembership || !isUserManagementAdmin(actorMembership)) {
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
  const priceListIds: string[] = Array.isArray(body?.priceListIds)
    ? body.priceListIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0).map((id: string) => id.trim())
    : [];

  if (!email) {
    return NextResponse.json(
      { ok: false, reason: "EMAIL_REQUIRED" },
      { status: 400 }
    );
  }

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
    actorMembership.role === "OWNER" || targetMembership.role === "USER";

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
      if (isS3StoragePath(previousLogoPath)) {
        deleteAttachmentFromS3(previousLogoPath).catch(() => {});
      } else {
        const absolutePath = path.join(
          process.cwd(),
          "public",
          previousLogoPath.replace(/^\//, ""),
        );

        unlink(absolutePath).catch(() => {});
      }
    }

    await prisma.membership.update({
      where: { id: targetMembership.id },
      data: {
        warehouseEmail,
      },
    });

    await prisma.membershipPriceList.deleteMany({
      where: { membershipId: targetMembership.id },
    });

    if (priceListIds.length > 0) {
      await prisma.membershipPriceList.createMany({
        data: priceListIds.map((priceListId) => ({
          membershipId: targetMembership.id,
          priceListId,
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
