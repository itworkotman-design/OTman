import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createAccountingSsoTicket } from "@/lib/integrations/accounting/ssoTicket";
import { getModuleAccess } from "@/lib/users/access";

/**
 * The dashboard's "Accounting" link: signs the logged-in person into the OtmanAccounting app. Needs the Accounting
 * app access (MembershipAppAccess ACCOUNTING, granted by an owner) in the company the accounting app keeps the books
 * for (OTMAN_API_COMPANY_ID). Redirects to ACCOUNTING_APP_URL/sso with a one-time signed ticket (ssoTicket.ts).
 */
export async function GET(request: Request) {
  const session = await getAuthenticatedSession(request);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const companyId = process.env.OTMAN_API_COMPANY_ID?.trim();
  const privateKey = process.env.ACCOUNTING_SSO_PRIVATE_KEY?.trim();
  const appUrl = process.env.ACCOUNTING_APP_URL?.trim();
  if (!companyId || !privateKey || !appUrl) {
    return NextResponse.json({ ok: false, reason: "SSO_NOT_CONFIGURED" }, { status: 503 });
  }

  const membership =
    session.activeCompanyId === companyId
      ? await prisma.membership.findUnique({
          where: { userId_companyId: { userId: session.userId, companyId } },
          select: { status: true, appAccess: true },
        })
      : null;
  if (!membership || membership.status !== "ACTIVE" || !getModuleAccess(membership, "ACCOUNTING").enabled) {
    return NextResponse.json({ ok: false, reason: "NO_ACCOUNTING_ACCESS" }, { status: 403 });
  }

  const ticket = createAccountingSsoTicket(
    { userId: session.userId, email: session.email, name: session.username?.trim() || session.email },
    privateKey,
  );
  const target = new URL("/sso", appUrl);
  target.searchParams.set("ticket", ticket);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("cache-control", "no-store");
  return response;
}
