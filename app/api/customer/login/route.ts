import { NextResponse } from "next/server";
import { loginCustomer } from "@/lib/customerAccounts/customerLogin";
import { setCustomerSessionCookie } from "@/lib/customerAccounts/customerSession";
import { getClientIp } from "@/lib/customerAccounts/requestIp";

// "My order" login: the customer's email + the password emailed with their
// order. See lib/customerAccounts/customerLogin.ts.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const result = await loginCustomer({ email, password, ip: getClientIp(req) });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: result.reason === "RATE_LIMITED" ? 429 : 401 });
  }

  const res = NextResponse.json({ ok: true });
  setCustomerSessionCookie(res, result.token, result.expiresAt);
  return res;
}
