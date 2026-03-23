import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { OrderForm } from "@/app/_components/Dahsboard/booking/create/OrderForm";
import type { OrderFormPayload } from "@/app/_components/Dahsboard/booking/create/OrderForm";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";

export default async function CreatePage() {
  const headerStore = await headers();

  const req = new Request("http://localhost/booking/create", {
    headers: headerStore,
  });

  const session = await getAuthenticatedSession(req);

  if (!session) {
    redirect("/login");
  }

  if (!session.activeCompanyId) {
    redirect("/select-company");
  }

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!membership || !membership.permissions.includes("BOOKING_CREATE")) {
    redirect("/booking");
  }

  const handleSubmit = async (payload: OrderFormPayload) => {
    "use server";
    console.log("Order payload:", payload);
    // TODO: send payload to your API / database here
  };

  return <OrderForm dataset="default" onSubmit={handleSubmit} />;
}