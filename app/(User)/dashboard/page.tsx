import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { getModuleAccess, hasAnyVisibleDashboardSection } from "@/lib/users/access";
import type { AppModule } from "@prisma/client";
import DashboardHomeShell from "@/app/_components/Dahsboard/home/DashboardHomeShell";
import DashboardHome from "@/app/_components/Dahsboard/home/DashboardHome";

// Checked in priority order when the caller has no DASHBOARD access — lands
// them on the first module they actually have, instead of a dead end.
const FALLBACK_MODULES: { module: AppModule; href: string }[] = [
  { module: "BOOKING", href: "/dashboard/booking" },
  { module: "ARCHIVE", href: "/dashboard/archive" },
  { module: "WEBSITE_ORDERS", href: "/dashboard/website-orders" },
  { module: "WEBSITE_EDITOR", href: "/dashboard/website" },
  { module: "USER_MANAGEMENT", href: "/dashboard/users" },
  { module: "SCHEDULER", href: "/dashboard/scheduler-orders" },
];

export default async function Dashboard() {
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
    redirect("/login");
  }

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!membership) {
    redirect("/login");
  }

  if (hasAnyVisibleDashboardSection(membership)) {
    return (
      <DashboardHomeShell>
        <DashboardHome />
      </DashboardHomeShell>
    );
  }

  const fallback = FALLBACK_MODULES.find(
    ({ module }) => getModuleAccess(membership, module).enabled,
  );

  if (fallback) {
    redirect(fallback.href);
  }

  return (
    <DashboardHomeShell>
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
        <p className="text-textColorThird">
          You don&apos;t have access to any app yet. Ask an admin to grant you one.
        </p>
      </div>
    </DashboardHomeShell>
  );
}
