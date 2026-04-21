import { NextResponse } from "next/server";
import { loginWithIdentifierPassword } from "@/lib/auth/login";
import { setSessionCookie } from "@/lib/auth/session";

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    return first || null;
  }
  return null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const identifier =
    typeof body?.identifier === "string"
      ? body.identifier
      : typeof body?.email === "string"
        ? body.email
        : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const userAgent = req.headers.get("user-agent");
  const ip = getClientIp(req);

  const result = await loginWithIdentifierPassword({
    identifier,
    password,
    ip,
    userAgent,
  });

  if (!result.ok) {
    const status = result.reason === "RATE_LIMITED" ? 429 : 401;

    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status }
    );
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
  return res;
}
