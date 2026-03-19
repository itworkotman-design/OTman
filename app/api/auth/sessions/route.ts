import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId: session.userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      createdAt: true,
    },
    orderBy: [
      { lastSeenAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json(
    {
      ok: true,
      currentSessionId: session.sessionId,
      sessions,
    },
    { status: 200 }
  );
}
