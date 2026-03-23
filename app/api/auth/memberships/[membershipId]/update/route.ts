import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { prisma } from "@/lib/db";

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
  const body = await req.json();

  const username =
    typeof body.username === "string" ? body.username.trim() || null : null;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

  const phoneNumber =
    typeof body.phoneNumber === "string" ? body.phoneNumber.trim() || null : null;
  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;

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
    actorMembership.role === "OWNER" ||
    (actorMembership.role === "ADMIN" && targetMembership.role === "USER");

  if (!canEditTarget) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: targetMembership.userId },
      data: {
        email,
        username,
        phoneNumber,
        description,
      },
      select: {
        id: true,
        email: true,
        username: true,
        phoneNumber: true,
        description: true,
        status: true,
      },
    });

    return NextResponse.json({ ok: true, user }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: "UPDATE_FAILED" },
      { status: 400 }
    );
  }
}