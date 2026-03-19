import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { selectActiveTenantForSession } from "@/lib/auth/tenantSelect";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const companyId = typeof body?.companyId === "string" ? body.companyId : "";

  const result = await selectActiveTenantForSession({
    sessionId: session.sessionId,
    userId: session.userId,
    companyId,
  });

  if (!result.ok) {
    const status =
      result.reason === "INVALID_COMPANY_ID"
        ? 400
        : result.reason === "FORBIDDEN"
          ? 403
          : 404;

    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      activeTenant: {
        companyId: result.companyId,
        companyName: result.companyName,
        companySlug: result.companySlug,
      },
    },
    { status: 200 }
  );
}
