import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      now: new Date().toISOString(),
    },
    { status: 200 },
  );
}
