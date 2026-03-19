import { NextResponse } from "next/server";
import { getAuthenticatedSession, clearSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { AuthEventType } from "@prisma/client";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearSessionCookie(res);

  if (!session) {
    return res;
  }

  await prisma.session.updateMany({
    where: {
      id: session.sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  await logAuthEvent({
    type: AuthEventType.LOGOUT,
    userId: session.userId,
  });

  return res;
}