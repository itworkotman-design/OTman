import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { signupWithEmailPassword } from "@/lib/auth/signup";

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

  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const companyName =
    typeof body?.companyName === "string" ? body.companyName : "";

  const userAgent = req.headers.get("user-agent");
  const ip = getClientIp(req);

  const result = await signupWithEmailPassword({
    email,
    password,
    companyName,
    ip,
    userAgent,
  });

  if (!result.ok) {
    const status =
      result.reason === "EMAIL_ALREADY_EXISTS"
        ? 409
        : result.reason === "INVALID_INPUT"
          ? 400
          : 400;

    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status }
    );
  }

  const res = NextResponse.json({ ok: true }, { status: 201 });
  setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
  return res;
}