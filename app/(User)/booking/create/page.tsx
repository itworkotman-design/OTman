"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BookingEditor, {
  type OrderFormPayload,
} from "@/app/_components/Dahsboard/booking/BookingEditor";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { canCreateOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";
import { OrderFields } from "@/app/_components/Dahsboard/booking/create/orderFields";


export default function BookingCreatePage() {
  const router = useRouter();
  const currentUser = useCurrentUser();

  const role = currentUser?.role ?? "USER";
  const permissions = (currentUser?.permissions ?? []) as AppPermission[];

  const canCreate = useMemo(() => {
    return canCreateOrders(role, permissions);
  }, [role, permissions]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  

  async function handleCreateOrder(payload: OrderFormPayload) {
    setSubmitError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setSubmitError(data?.reason || "Failed to create order");
        return;
      }

      router.push("/booking");
      router.refresh();
    } catch {
      setSubmitError("Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-[1400px] py-10">
        <div className="text-textColorThird">Loading...</div>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-[1400px] py-10">
        <h1 className="mb-4 text-2xl font-semibold text-logoblue">
          Create booking
        </h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          You do not have access to create orders.
        </div>
      </div>
    );
  }

const HIDE_FOR_CREATOR =
  OrderFields.FeeExtraWork |
  OrderFields.FeeAddToOrder |
  OrderFields.ChangeCustomer;

  return (
    <div className="mx-auto max-w-[1600px]">
      {submitError ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {submitError}
        </div>
      ) : null}

      {submitting ? (
        <div className="mb-5 rounded-xl border border-black/10 bg-white p-4 text-textColorThird">
          Saving order...
        </div>
      ) : null}

      <BookingEditor hidden={HIDE_FOR_CREATOR} onSubmit={handleCreateOrder} />
    </div>
  );
}
