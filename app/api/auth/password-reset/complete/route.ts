import { NextResponse } from "next/server";
import { completePasswordReset } from "@/lib/auth/passwordResetComplete";

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

  const token = typeof body?.token === "string" ? body.token : "";
  const newPassword =
    typeof body?.newPassword === "string" ? body.newPassword : "";

  const userAgent = req.headers.get("user-agent");
  const ip = getClientIp(req);

  const result = await completePasswordReset({
    token,
    newPassword,
    ip,
    userAgent,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}