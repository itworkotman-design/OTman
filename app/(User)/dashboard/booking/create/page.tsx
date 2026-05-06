"use client";

import { useState } from "react";
import BookingEditor, {
  type OrderFormPayload,
} from "@/app/_components/Dahsboard/booking/BookingEditor";
import { bookingText } from "@/lib/booking/bookingUiText";
import { useUserLanguage } from "@/lib/users/language";
import { useCurrentUser } from "@/lib/users/useCurrentUser";

export default function CreateBookingPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const t = (text: string) => bookingText(locale, text);
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

  return (
    <div className="mx-auto w-full max-w-[1600]">
      {successMessage ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{successMessage}</div>
      ) : null}

      <BookingEditor
        key={editorKey}
        onSubmit={handleCreateOrder}
        showCapacityDetails={true}
        locale={locale}
        isOrderCreator={false}
      />
    </div>
  );
}
