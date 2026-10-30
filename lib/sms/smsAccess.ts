import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/users/orderAccess";
import type { OrderEventActor } from "@/lib/orders/orderEvents";

export type SmsAdminAccess =
  | { ok: true; companyId: string; membershipId: string; actor: OrderEventActor }
  | { ok: false; response: NextResponse };

// SMS costs money and goes straight to customers' phones, so every SMS route
// (composer, bulk send, templates) is limited to company OWNER/ADMIN — the
// same bar as the booking archive's ADMIN view where the SMS UI lives.
export async function requireSmsAdmin(req: Request): Promise<SmsAdminAccess> {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }) };
  }

  if (!session.activeCompanyId) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }) };
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId: session.activeCompanyId, status: "ACTIVE" },
    select: { id: true, role: true, user: { select: { username: true, email: true } } },
  });

  if (!membership || !hasFullAccess(membership.role)) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }) };
  }

  return {
    ok: true,
    companyId: session.activeCompanyId,
    membershipId: membership.id,
    actor: {
      membershipId: membership.id,
      name: membership.user.username ?? null,
      email: membership.user.email,
      source: "USER",
    },
  };
}
