import { AuthEventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuthEvent } from "@/lib/auth/authEvent";

type SelectActiveTenantResult =
  | {
      ok: true;
      companyId: string;
      companyName: string;
      companySlug: string | null;
    }
  | {
      ok: false;
      reason: "INVALID_COMPANY_ID" | "FORBIDDEN" | "SESSION_NOT_FOUND";
    };

export async function selectActiveTenantForSession(params: {
  sessionId: string;
  userId: string;
  companyId: string;
}): Promise<SelectActiveTenantResult> {
  const companyId = params.companyId.trim();

  if (!companyId) {
    return { ok: false, reason: "INVALID_COMPANY_ID" };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: params.userId,
      companyId,
      status: "ACTIVE",
      company: {
        status: "ACTIVE",
      },
    },
    select: {
      companyId: true,
      company: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!membership) {
    return { ok: false, reason: "FORBIDDEN" };
  }

  const updateResult = await prisma.session.updateMany({
    where: {
      id: params.sessionId,
      userId: params.userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    data: {
      activeCompanyId: membership.companyId,
    },
  });

  if (updateResult.count !== 1) {
    return { ok: false, reason: "SESSION_NOT_FOUND" };
  }

  await logAuthEvent({
    type: AuthEventType.TENANT_SELECTED,
    userId: params.userId,
    companyId: membership.companyId,
    meta: {
      sessionId: params.sessionId,
    },
  });

  return {
    ok: true,
    companyId: membership.companyId,
    companyName: membership.company.name,
    companySlug: membership.company.slug,
  };
}
