import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { getModuleAccess } from "@/lib/users/access";
import BookingDashboardShell from "@/app/_components/Dahsboard/booking/BookingDashboardShell";

export default async function AppLayout({
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

  const req = new Request(`${protocol}://${host}/dashboard/booking`, {
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

  // Previously relied entirely on the dashboard shell's old blanket "USER
  // role always redirected" rule. That rule is gone now that app access is a
  // per-person grant, so this section needs its own explicit check.
  if (!getModuleAccess(membership, "BOOKING").enabled) {
    redirect("/dashboard");
  }

  return <BookingDashboardShell>{children}</BookingDashboardShell>;
}
