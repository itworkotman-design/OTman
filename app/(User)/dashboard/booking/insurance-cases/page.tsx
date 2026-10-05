import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { hasFullAccess } from "@/lib/users/access";
import { getInsuranceCasesStore } from "@/lib/orders/insuranceCases";
import BookingOrdersView from "@/app/_components/Dahsboard/booking/orders/BookingOrdersView";

// Admin-only copy of the main order list, locked to the one store that
// handles every insurance case (INSURANCE_CASES_USER_EMAIL). The parent
// booking layout already enforces the BOOKING module grant.
export default async function InsuranceCasesPage() {
  const requestHeaders = await headers();

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host");

  if (!host) {
    redirect("/login");
  }

  const req = new Request(`${protocol}://${host}/dashboard/booking/insurance-cases`, {
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

  if (!hasFullAccess(membership.role)) {
    redirect("/dashboard/booking");
  }

  const store = await getInsuranceCasesStore(session.activeCompanyId);

  if (!store.ok) {
    return (
      <div className="w-full">
        <h1 className="mb-4 sm:mb-10 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
          Insurance cases
        </h1>
        <div className="customContainer text-sm text-textColorSecond">
          {store.reason === "NOT_CONFIGURED"
            ? "The insurance cases store is not configured. Set INSURANCE_CASES_USER_EMAIL to the email of the user that handles insurance cases."
            : `No active user with email ${store.email} (INSURANCE_CASES_USER_EMAIL) was found in this company.`}
        </div>
      </div>
    );
  }

  return (
    <BookingOrdersView
      insuranceCases={{ storeMembershipId: store.membershipId, storeLabel: store.label }}
    />
  );
}
