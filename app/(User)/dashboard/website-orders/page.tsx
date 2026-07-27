"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getBookingArchiveAccess } from "@/lib/orders/archiveAccess";
import { bookingText } from "@/lib/booking/bookingUiText";
import { getDefaultVisibleBookingArchiveColumns, type BookingArchiveColumnId } from "@/lib/booking/archiveColumns";

// Website orders have no associated store/cashier and never use the DNB
// discount, so those admin-default columns are just noise on this page.
const HIDDEN_COLUMN_IDS = new Set<BookingArchiveColumnId>(["createdBy", "orderNumber", "cashierName", "cashierPhone", "dnbDiscount"]);
const WEBSITE_ORDERS_VISIBLE_COLUMNS = getDefaultVisibleBookingArchiveColumns("ADMIN").filter(
  (columnId) => !HIDDEN_COLUMN_IDS.has(columnId),
);
import BookingArchiveTable from "@/app/_components/Dahsboard/booking/archive/BookingArchiveTable";
import OrderModal from "@/app/_components/Dahsboard/booking/OrderModal";
import OrderEmailModal from "@/app/_components/Dahsboard/booking/archive/OrderEmailModal";
import WebsiteOrdersActionBar from "@/app/_components/Dahsboard/booking/websiteOrders/WebsiteOrdersActionBar";
import type { OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";

type OrdersApiResponse = {
  ok?: boolean;
  orders?: OrderRow[];
};

export default function WebsiteOrdersPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const access = getBookingArchiveAccess(currentUser);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [emailOrder, setEmailOrder] = useState<OrderRow | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/orders?isWebsiteOrder=true&rowsPerPage=500", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as OrdersApiResponse | null;

      if (!res.ok || !data?.ok) {
        setError(bookingText(locale, "failed to load orders"));
        setOrders([]);
        return;
      }

      const nextOrders = data.orders ?? [];
      setOrders(nextOrders);
      setSelectedOrderIds((prev) => prev.filter((id) => nextOrders.some((o) => o.id === id)));
    } catch {
      setError(bookingText(locale, "failed to load orders"));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestLifecycleEmail(
    orderIds: string[],
    kind: "payment_request" | "rejected" | "payment_timeout",
  ): Promise<{ ok: boolean; reason?: string }> {
    try {
      const res = await fetch("/api/orders/send-lifecycle-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, kind }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        return { ok: false, reason: data?.reason || "Failed to send email" };
      }

      return { ok: true };
    } catch {
      return { ok: false, reason: "Failed to send email" };
    }
  }

  async function handleApprove(sendEmail: boolean): Promise<boolean> {
    if (selectedOrderIds.length === 0) return false;
    const orderIds = selectedOrderIds;

    try {
      setActionLoading(true);
      setActionError("");

      const res = await fetch("/api/orders/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, status: "approved" }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setActionError(data?.reason || "Failed to approve orders");
        return false;
      }

      if (sendEmail) {
        const emailResult = await requestLifecycleEmail(orderIds, "payment_request");
        if (!emailResult.ok) {
          setActionError(`Orders approved, but failed to send payment email: ${emailResult.reason}`);
        }
      }

      setSelectedOrderIds([]);
      await loadOrders();
      return true;
    } catch {
      setActionError("Failed to approve orders");
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(comment: string, sendEmail: boolean): Promise<boolean> {
    if (selectedOrderIds.length === 0) return false;
    const orderIds = selectedOrderIds;

    try {
      setActionLoading(true);
      setActionError("");

      const res = await fetch("/api/orders/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, status: "rejected", statusNotes: comment }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setActionError(data?.reason || "Failed to reject orders");
        return false;
      }

      if (sendEmail) {
        const emailResult = await requestLifecycleEmail(orderIds, "rejected");
        if (!emailResult.ok) {
          setActionError(`Orders rejected, but failed to send rejection email: ${emailResult.reason}`);
        }
      }

      setSelectedOrderIds([]);
      await loadOrders();
      return true;
    } catch {
      setActionError("Failed to reject orders");
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendEmail(kind: "payment_request" | "rejected" | "payment_timeout"): Promise<boolean> {
    if (selectedOrderIds.length === 0) return false;

    try {
      setActionLoading(true);
      setActionError("");

      const result = await requestLifecycleEmail(selectedOrderIds, kind);

      if (!result.ok) {
        setActionError(result.reason || "Failed to send email");
        return false;
      }

      return true;
    } catch {
      setActionError("Failed to send email");
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  function handleToggleOrder(orderId: string) {
    setSelectedOrderIds((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]));
  }

  function handleToggleAllVisible() {
    const visibleIds = orders.map((order) => order.id);
    setSelectedOrderIds((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }

  if (access.viewMode !== "ADMIN") {
    return (
      <div className="w-full">
        <p className="text-textColorThird">{bookingText(locale, "You do not have access to create orders.")}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
            {locale === "nb" ? "Nettsidebestillinger" : "Website orders"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-textColorThird">
            {locale === "nb"
              ? "Gjennomgå bestillinger fra nettsiden, godkjenn eller avvis dem, og send betalings-e-post til kunden når en bestilling er godkjent."
              : "Review orders submitted from the website, approve or reject them, and send the customer a payment email once an order is approved."}
          </p>
        </div>

        {!loading && !error && (
          <div className="customInput px-4 py-2 text-sm font-medium text-textColorThird">
            {orders.length} {bookingText(locale, orders.length === 1 ? "Order" : "Orders")}
          </div>
        )}
      </div>

      <WebsiteOrdersActionBar
        selectedCount={selectedOrderIds.length}
        onApprove={handleApprove}
        onReject={handleReject}
        onSendEmail={handleSendEmail}
        onClear={() => setSelectedOrderIds([])}
        loading={actionLoading}
        error={actionError}
        locale={locale}
      />

      <div className="min-w-0 w-full overflow-x-auto mt-6">
        {loading ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">{bookingText(locale, "Loading orders...")}</div>
        ) : error ? (
          <div className="customContainer flex items-center justify-center border-red-200! bg-red-50 py-10 text-sm font-medium text-red-600">{error}</div>
        ) : orders.length === 0 ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">{bookingText(locale, "No orders found")}</div>
        ) : (
          <BookingArchiveTable
            orders={orders}
            viewMode="ADMIN"
            onRowClick={(orderId) => {
              setSelectedOrderId(orderId);
              setModalOpen(true);
            }}
            onAlertClick={(order) => {
              setEmailOrder(order);
              setEmailModalOpen(true);
            }}
            selectable
            selectedOrderIds={selectedOrderIds}
            onToggleOrder={handleToggleOrder}
            onToggleAllVisible={handleToggleAllVisible}
            visibleColumnIds={WEBSITE_ORDERS_VISIBLE_COLUMNS}
            locale={locale}
          />
        )}
      </div>

      <OrderModal
        orderId={selectedOrderId}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOrderId(null);
        }}
        onSaved={() => void loadOrders()}
        canDelete={false}
        locale={locale}
        onDeleted={() => {
          setModalOpen(false);
          setSelectedOrderId(null);
          void loadOrders();
        }}
      />

      <OrderEmailModal
        open={emailModalOpen}
        order={emailOrder}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailOrder(null);
        }}
        onAlertsChanged={() => void loadOrders()}
      />
    </div>
  );
}
