import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { getModuleAccess } from "@/lib/users/access";
import WebsiteEditorShell from "@/app/_components/Dahsboard/website/WebsiteEditorShell";

export default async function WebsiteEditorLayout({
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

  const req = new Request(`${protocol}://${host}/dashboard/website`, {
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

  // This section had no gate at all before — it relied entirely on the
  // dashboard shell's old blanket "USER role always redirected" rule, which
  // no longer exists now that app access is a per-person grant.
  if (!getModuleAccess(membership, "WEBSITE_EDITOR").enabled) {
    redirect("/dashboard");
  }

  return <WebsiteEditorShell>{children}</WebsiteEditorShell>;
}
