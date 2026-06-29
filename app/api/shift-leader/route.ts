import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const companyId = session.activeCompanyId;
  if (!companyId) {
    return NextResponse.json({ ok: true, shiftLeader: null });
  }

  const record = await prisma.shiftLeader.findUnique({ where: { companyId } });

  if (!record || record.date !== todayDateString()) {
    return NextResponse.json({ ok: true, shiftLeader: null });
  }

  return NextResponse.json({
    ok: true,
    shiftLeader: { userId: record.userId, username: record.username },
  });
}

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const companyId = session.activeCompanyId;
  if (!companyId) {
    return NextResponse.json({ ok: false, reason: "NO_COMPANY" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false, reason: "USER_NOT_FOUND" }, { status: 404 });
  }

  const record = await prisma.shiftLeader.upsert({
    where: { companyId },
    update: {
      userId: user.id,
      username: user.username ?? user.id,
      date: todayDateString(),
      setAt: new Date(),
    },
    create: {
      companyId,
      userId: user.id,
      username: user.username ?? user.id,
      date: todayDateString(),
    },
  });

  return NextResponse.json({
    ok: true,
    shiftLeader: { userId: record.userId, username: record.username },
  });
}
