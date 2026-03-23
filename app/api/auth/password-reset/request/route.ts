import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/passwordResetRequest";
//RALFS ADDED
import { initAuth } from "@/lib/auth/init";

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    return first || null;
  }
  return null;
}

export async function POST(req: Request) {
  //RALFS ADDED
  initAuth();

  const body = await req.json().catch(() => null);

  const email = typeof body?.email === "string" ? body.email : "";

  const userAgent = req.headers.get("user-agent");
  const ip = getClientIp(req);

  const result = await requestPasswordReset({
    email,
    ip,
    userAgent,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 429 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}