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

const HIDE_FOR_CREATOR =
  OrderFields.FeeExtraWork |
  OrderFields.FeeAddToOrder |
  OrderFields.ChangeCustomer;

export default function BookingCreatePage() {
  const router = useRouter();
  const currentUser = useCurrentUser();

  const role = currentUser?.role ?? "USER";
  const permissions = (currentUser?.permissions ?? []) as AppPermission[];

  const canCreate = useMemo(() => {
    return canCreateOrders(role, permissions);
  }, [role, permissions]);

  const [editorKey, setEditorKey] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleCreateOrder(payload: OrderFormPayload) {
    setSubmitError("");

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

    setSuccessMessage(`Order created (${data.displayId ?? data.orderId})`);
    setEditorKey((prev) => prev + 1);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-[1400] py-10">
        <div className="text-textColorThird">Loading...</div>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-[1400] py-10">
        <h1 className="mb-4 text-2xl font-semibold text-logoblue">
          Create booking
        </h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          You do not have access to create orders.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600]">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
            Create booking
          </h1>
        </div>
      </div>

      {successMessage ? (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
          {successMessage}
        </div>
      ) : null}

      {submitError ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {submitError}
        </div>
      ) : null}

      <BookingEditor
        key={editorKey}
        hidden={HIDE_FOR_CREATOR}
        onSubmit={handleCreateOrder}
      />
    </div>
  );
}
