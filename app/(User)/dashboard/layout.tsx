import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { hasAnyAppAccess } from "@/lib/users/access";

export default async function DashboardLayout({
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

  const req = new Request(`${protocol}://${host}/dashboard`, {
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

  // Any membership (OWNER/ADMIN/USER alike) with no enabled app at all has
  // nothing to do in the dashboard shell — send them to the plain booking
  // app instead. This replaces the old flat "USER role always redirects"
  // rule: app access is now a per-person MembershipAppAccess grant,
  // independent of company Role, so even a USER-role member with an
  // enabled module reaches the dashboard now.
  if (!hasAnyAppAccess(membership)) {
    redirect("/booking");
  }

  return <>{children}</>;
}