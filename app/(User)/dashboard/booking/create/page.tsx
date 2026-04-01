"use client";

import { useState } from "react";
import BookingEditor, {
  type OrderFormPayload,
} from "@/app/_components/Dahsboard/booking/BookingEditor";

export default function CreateBookingPage() {
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
      throw new Error(data?.reason || "Failed to create order");
    }

    setSuccessMessage(`Order created (${data.displayId ?? data.orderId})`);
    setEditorKey((prev) => prev + 1);

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  }

  return (
    <div className="mx-auto w-full max-w-[1600]">
      {successMessage ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMessage}
        </div>
      ) : null}

      <BookingEditor key={editorKey} onSubmit={handleCreateOrder} />
    </div>
  );
}
