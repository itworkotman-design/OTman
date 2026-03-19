import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { AuthEventType } from "@prisma/client";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);

  const sessionId =
    typeof body?.sessionId === "string" ? body.sessionId.trim() : "";

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_SESSION_ID" },
      { status: 400 }
    );
  }

  if (sessionId === session.sessionId) {
    return NextResponse.json(
      { ok: false, reason: "CANNOT_REVOKE_CURRENT_SESSION" },
      { status: 400 }
    );
  }

  const result = await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId: session.userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    data: {
      revokedAt: new Date(),
    },
  });

  if (result.count > 0) {
    await logAuthEvent({
      type: AuthEventType.SESSION_REVOKED,
      userId: session.userId,
      meta: {
        revokedSessionId: sessionId,
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
