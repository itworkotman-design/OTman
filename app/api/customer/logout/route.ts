import { NextResponse } from "next/server";
import { clearCustomerSessionCookie, getCustomerSession, revokeCustomerSession } from "@/lib/customerAccounts/customerSession";

export async function POST(req: Request) {
  const session = await getCustomerSession(req);
  if (session) await revokeCustomerSession(session.sessionId);

  const res = NextResponse.json({ ok: true });
  clearCustomerSessionCookie(res);
  return res;
}
