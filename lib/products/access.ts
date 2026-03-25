import { getActiveMembership } from "@/lib/auth/membership";

export async function requireProductAdminAccess(params: {
  userId: string;
  companyId: string;
}) {
  const membership = await getActiveMembership({
    userId: params.userId,
    companyId: params.companyId,
  });

  if (!membership) {
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  return { ok: true as const, membership };
}
