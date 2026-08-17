"use client";

import { useMemo, useState } from "react";
import BookingEditor, {
  type OrderFormPayload,
} from "@/app/_components/Dahsboard/booking/BookingEditor";
import { bookingText } from "@/lib/booking/bookingUiText";
import { useUserLanguage } from "@/lib/users/language";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { canCreateOrders } from "@/lib/users/orderAccess";
import { hasFullAccess } from "@/lib/users/access";
import type { AppPermission } from "@/lib/users/types";
import { HIDE_FOR_ORDER_CREATOR_EXTRA_MASK } from "@/lib/booking/orderFormVisibility";

export default function CreateBookingPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const t = (text: string) => bookingText(locale, text);

  const role = currentUser?.role ?? "USER";
  const fullAccess = hasFullAccess(role);

  const canCreate = useMemo(() => {
    const permissions = (currentUser?.permissions ?? []) as AppPermission[];
    return canCreateOrders(role, permissions);
  }, [currentUser?.permissions, role]);

  const [editorKey, setEditorKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");

  async function handleCreateOrder(payload: OrderFormPayload) {
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
      throw new Error(
        data?.message || data?.reason || t("failed to create order"),
      );
    }

    setSuccessMessage(`${t("Order created")} (${data.displayId ?? data.orderId})`);
    setEditorKey((prev) => prev + 1);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  }

  if (!currentUser) {
    return (
      <div className="mx-auto w-full max-w-[1600] py-10">
        <div className="text-textColorThird">{t("Loading...")}</div>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="mx-auto w-full max-w-[1600] py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {t("You do not have access to create orders.")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600]">
      {successMessage ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{successMessage}</div>
      ) : null}

      <BookingEditor
        key={editorKey}
        onSubmit={handleCreateOrder}
        showCapacityDetails={fullAccess}
        locale={locale}
        isOrderCreator={canCreate && !fullAccess}
        hidden={fullAccess ? 0 : HIDE_FOR_ORDER_CREATOR_EXTRA_MASK}
      />
    </div>
  );
}
