"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BookingEditor, {
  type OrderFormPayload,
} from "@/app/_components/Dahsboard/booking/BookingEditor";

type OrderDetails = OrderFormPayload & {
  id: string;
};

type Props = {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
};

export default function OrderModal({ orderId, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure we're on the client before portaling into document.body
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !orderId) return;

    async function loadOrder() {
      try {
        setLoading(true);
        setError("");
        setOrder(null);

        const res = await fetch(`/api/orders/${orderId}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setError(data?.reason || "Failed to load order");
          return;
        }

        setOrder(data.order ?? null);
      } catch {
        setError("Failed to load order");
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [open, orderId]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function handleSave(payload: OrderFormPayload) {
    if (!orderId) return;

    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      throw new Error(data?.reason || "Failed to update order");
    }
  }

  if (!open || !mounted) return null;

  // createPortal renders directly into document.body, escaping any parent
  // that has transform/filter/isolation which would break fixed positioning
  // and clip the bg-black/50 backdrop.
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center px-3 py-6 lg:px-6 lg:py-10">
        <div
          className="w-full max-w-[1700] max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky header */}
          <div className="shrink-0 flex items-center justify-between rounded-t-2xl border-b bg-white px-6 py-4">
            <h2 className="text-2xl font-semibold text-logoblue">
              {orderId ? `Edit order ${orderId}` : "Order"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white"
            >
              ×
            </button>
          </div>

          {/* Scrollable body — only this div scrolls */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            {loading ? (
              <div className="py-6 text-textColorThird">Loading order...</div>
            ) : error ? (
              <div className="py-6 text-red-600">{error}</div>
            ) : (
              <BookingEditor
                onSubmit={handleSave}
                initialValues={order ?? undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
