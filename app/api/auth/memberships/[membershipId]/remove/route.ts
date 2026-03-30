import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const { membershipId } = await context.params;
  const targetMembershipId =
    typeof membershipId === "string" ? membershipId.trim() : "";

  if (!targetMembershipId) {
    return NextResponse.json(
      { ok: false, reason: "MEMBERSHIP_NOT_FOUND" },
      { status: 404 },
    );
  }

  const targetMembership = await prisma.membership.findUnique({
    where: { id: targetMembershipId },
    select: {
      id: true,
      userId: true,
      companyId: true,
      role: true,
      status: true,
    },
  });

  if (!targetMembership) {
    return NextResponse.json(
      { ok: false, reason: "MEMBERSHIP_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (targetMembership.companyId !== session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
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
      { status: 403 },
    );
  }

  if (targetMembership.userId === session.userId) {
    return NextResponse.json(
      { ok: false, reason: "CANNOT_REMOVE_SELF" },
      { status: 400 },
    );
  }

  if (actorMembership.role === "ADMIN" && targetMembership.role !== "USER") {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (targetMembership.role === "OWNER") {
    const activeOwnerCount = await prisma.membership.count({
      where: {
        companyId: targetMembership.companyId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    if (activeOwnerCount <= 1) {
      return NextResponse.json(
        { ok: false, reason: "CANNOT_REMOVE_LAST_OWNER" },
        { status: 400 },
      );
    }
  }

  await prisma.membership.delete({
    where: {
      id: targetMembership.id,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
