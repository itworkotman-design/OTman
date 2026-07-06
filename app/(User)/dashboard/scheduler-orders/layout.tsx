import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { canManageAutomaticOrders } from "@/lib/users/orderAccess";
import AutomaticOrdersShell from "@/app/_components/Dahsboard/automaticOrders/AutomaticOrdersShell";

export default async function AutomaticOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host");

  if (!host) {
    redirect("/login");
  }

  const req = new Request(`${protocol}://${host}/dashboard/scheduler-orders`, {
    headers: requestHeaders,
  });

  const session = await getAuthenticatedSession(req);

  if (!session) {
    redirect("/login");
  }

  if (!session.activeCompanyId) {
    redirect("/booking");
  }

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!membership) {
    redirect("/login");
  }

  if (!canManageAutomaticOrders(membership.role)) {
    redirect("/dashboard");
  }

  return <AutomaticOrdersShell>{children}</AutomaticOrdersShell>;
}
