"use client";

import { useEffect, useMemo, useState } from "react";
import BookingEditor, {
  type OrderFormPayload,
} from "@/app/_components/Dahsboard/booking/BookingEditor";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type OrderDetails = OrderFormPayload & {
  id: string;
  displayId?: number;
  subcontractorMembershipId?: string | null;
};

type Props = {
  orderId: string;
  locale?: BookingUiLocale;
  canDelete?: boolean;
  onSaved?: () => void;
  onDeleted?: () => void;
  // Called after a successful save or delete (the parent closes its modal).
  onDone: () => void;
  onLoaded?: (order: { displayId?: number }) => void;
};

// The admin order editor (load, save, delete). Used as the "Edit order" tab of
// the Alert Center (OrderEmailModal) and inside OrderModal.
export default function OrderEditPanel({ orderId, locale = "en", canDelete = false, onSaved, onDeleted, onDone, onLoaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;

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
        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          setError(data?.reason || "Failed to load order");
          return;
        }

        setOrder(data.order ?? null);
        if (data.order) onLoaded?.(data.order);
      } catch {
        if (!cancelled) setError("Failed to load order");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOrder();
    return () => {
      cancelled = true;
    };
    // onLoaded is a notification only; reloading when it changes identity
    // would refetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleSave(payload: OrderFormPayload) {
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

    onSaved?.();
    onDone();
  }

  async function handleDelete() {
    if (deleteLoading) return;
    if (!confirm(bookingText(locale, "Delete this order?"))) return;

    try {
      setDeleteLoading(true);
      setDeleteError("");

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setDeleteError(bookingText(locale, data?.reason || "Failed to delete order"));
        return;
      }

      onDeleted?.();
      onDone();
    } catch {
      setDeleteError(bookingText(locale, "Failed to delete order"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const bookingEditorInitialValues = useMemo(
    () =>
      order
        ? { ...order, subcontractorId: order.subcontractorId || order.subcontractorMembershipId || "" }
        : undefined,
    [order],
  );

  return (
    <>
      {loading ? (
        <div className="py-6 text-textColorThird">{bookingText(locale, "Loading order...")}</div>
      ) : error ? (
        <div className="py-6 text-red-600">{error}</div>
      ) : (
        <BookingEditor
          onSubmit={handleSave}
          initialValues={bookingEditorInitialValues}
          locale={locale}
          isOrderCreator={false}
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
            {deleteLoading ? bookingText(locale, "Deleting...") : bookingText(locale, "Delete order")}
          </button>
        )}
        {deleteError ? <div className="mt-2 text-sm font-medium text-red-600">{deleteError}</div> : null}
      </div>
    </>
  );
}
