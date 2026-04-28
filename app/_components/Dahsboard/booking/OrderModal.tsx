"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BookingEditor, {
  type OrderFormPayload,
} from "@/app/_components/Dahsboard/booking/BookingEditor";

type OrderDetails = OrderFormPayload & {
  id: string;
  displayId?: number;
  subcontractorMembershipId?: string | null;
};


type Props = {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  canDelete?: boolean;
  onDeleted?: () => void;
};

export default function OrderModal({
  orderId,
  open,
  onClose,
  onSaved,
  canDelete = false,
  onDeleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const archiveOrderId =
    typeof order?.displayId === "number" && order.displayId > 0
      ? String(order.displayId)
      : null;
  

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


    async function loadData() {
      await Promise.all([loadOrder()]);
    }

    loadData();
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
      throw new Error(data?.message || data?.reason || "Failed to update order");
    }

    // 👇 ADD THIS HERE
    onSaved?.();
    onClose();
  }

  async function handleDelete() {
    if (!orderId || deleteLoading) return;
    if (!confirm("Delete this order?")) return;

    try {
      setDeleteLoading(true);
      setDeleteError("");

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setDeleteError(data?.reason || "Failed to delete order");
        return;
      }

      onDeleted?.();
      onClose();
    } catch {
      setDeleteError("Failed to delete order");
    } finally {
      setDeleteLoading(false);
    }
  }


  if (!open || !mounted) return null;

  // createPortal renders directly into document.body, escaping any parent
  // that has transform/filter/isolation which would break fixed positioning
  // and clip the bg-black/50 backdrop.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center px-3 py-6 lg:px-6 lg:py-10">
        <div className="w-full max-w-[1700] max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Sticky header */}
          <div className="shrink-0 flex items-center justify-between rounded-t-2xl border-b bg-white px-6 py-4">
            <h2 className="text-2xl font-semibold text-logoblue">
              {archiveOrderId ? `Editing order - ${archiveOrderId}` : orderId ? "Editing order" : "Order"}
            </h2>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white cursor-pointer">
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
                initialValues={
                  order
                    ? {
                        ...order,
                        subcontractorId: order.subcontractorId || order.subcontractorMembershipId || "",
                      }
                    : undefined
                }
              />
            )}
            <div className="mt-10">
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="customButtonDefault h-10 bg-red-600! text-white! disabled:opacity-50!"
                >
                  {deleteLoading ? "Deleting..." : "Delete order"}
                </button>
              )}
              {deleteError ? <div className="mt-2 text-sm font-medium text-red-600">{deleteError}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
