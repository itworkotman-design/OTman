import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { isUserManagementAdmin } from "@/lib/users/access";
import type { OrderEventActor } from "@/lib/orders/orderEvents";

// Who may see and manage the "Website users" tab (app/api/auth/customer-
// accounts): the same user-management admins who manage staff — company
// OWNER, or USER_MANAGEMENT at ADMIN level. Returns the company and the actor
// to record on the customer's orders.
export async function requireWebsiteUsersAdmin(
  req: Request,
): Promise<
  | { ok: true; companyId: string; actor: OrderEventActor }
  | { ok: false; status: 401 | 403 | 409; reason: "UNAUTHORIZED" | "FORBIDDEN" | "TENANT_SELECTION_REQUIRED" }
> {
  const session = await getAuthenticatedSession(req);
  if (!session) return { ok: false, status: 401, reason: "UNAUTHORIZED" };
  if (!session.activeCompanyId) return { ok: false, status: 409, reason: "TENANT_SELECTION_REQUIRED" };

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId: session.activeCompanyId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      appAccess: { select: { module: true, enabled: true, level: true } },
      user: { select: { username: true, email: true } },
    },
  });
  if (!membership || !isUserManagementAdmin(membership)) return { ok: false, status: 403, reason: "FORBIDDEN" };

  return {
    ok: true,
    companyId: session.activeCompanyId,
    actor: { membershipId: membership.id, name: membership.user?.username ?? null, email: membership.user?.email ?? null, source: "USER" },
  };
}
