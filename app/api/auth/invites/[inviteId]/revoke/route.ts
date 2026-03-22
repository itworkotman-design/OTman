import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { revokeInvite } from "@/lib/auth/inviteRevoke";

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    return first || null;
  }
  return null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ inviteId: string }> }
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

  const { inviteId } = await context.params;

  const targetInviteId = typeof inviteId === "string" ? inviteId.trim() : "";

  const userAgent = req.headers.get("user-agent");
  const ip = getClientIp(req);

  const result = await revokeInvite({
    actorUserId: session.userId,
    inviteId: targetInviteId,
    ip,
    userAgent,
  });

  if (!result.ok) {
    const status =
      result.reason === "FORBIDDEN"
        ? 403
        : result.reason === "INVITE_NOT_FOUND"
          ? 404
          : 404;

    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
