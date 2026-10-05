import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCustomerSession, revokeCustomerSessions } from "@/lib/customerAccounts/customerSession";

const MIN_LENGTH = 8;

// A logged-in customer replaces the generated password with their own. Other
// sessions of the account are signed out; this one keeps working.
export async function POST(req: Request) {
  const session = await getCustomerSession(req);
  if (!session) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json({ ok: false, reason: "PASSWORD_TOO_SHORT" }, { status: 422 });
  }

  const account = await prisma.customerAccount.findUnique({ where: { id: session.accountId }, select: { passwordHash: true } });
  if (!account || !(await verifyPassword(account.passwordHash, currentPassword))) {
    return NextResponse.json({ ok: false, reason: "INVALID_CURRENT_PASSWORD" }, { status: 403 });
  }

  await prisma.customerAccount.update({ where: { id: session.accountId }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeCustomerSessions(session.accountId, session.sessionId);
  return NextResponse.json({ ok: true });
}
