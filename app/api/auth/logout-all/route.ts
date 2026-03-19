import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getAuthenticatedSession,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { AuthEventType } from "@prisma/client";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearSessionCookie(res);

  if (!session) {
    return res;
  }

  await revokeAllUserSessions(session.userId);

  await logAuthEvent({
    type: AuthEventType.LOGOUT,
    userId: session.userId,
  });

  return res;
}
