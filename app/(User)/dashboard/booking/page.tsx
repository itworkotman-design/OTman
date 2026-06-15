"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import OrderModal from "@/app/_components/Dahsboard/booking/OrderModal";
import BookingFilters from "@/app/_components/Dahsboard/booking/archive/BookingFilters";
import BookingArchiveTable from "@/app/_components/Dahsboard/booking/archive/BookingArchiveTable";
import OrderEmailModal from "@/app/_components/Dahsboard/booking/archive/OrderEmailModal";
import type {
  BookingArchiveFilters,
  BookingArchiveOption,
  OrderRow,
} from "@/app/_components/Dahsboard/booking/archive/types";
import { DEFAULT_BOOKING_ARCHIVE_FILTERS } from "@/lib/orders/archiveFilters";
import { getBookingArchiveAccess } from "@/lib/orders/archiveAccess";
import { bookingText } from "@/lib/booking/bookingUiText";
import { useUserLanguage } from "@/lib/users/language";
import BulkUpdateBar from "@/app/_components/Dahsboard/booking/archive/BulkUpdateBar";
import SelectionActionBar from "@/app/_components/Dahsboard/booking/archive/SelectionActionBar";
import BookingColumnVisibilityModal from "@/app/_components/Dahsboard/booking/archive/BookingColumnVisibilityModal";
import { exportOrdersToExcel } from "@/lib/booking/exportOrdersToExcel";
import {
  getDefaultVisibleBookingArchiveColumns,
  getBookingArchiveVisibilityStorageKey,
  sanitizeVisibleBookingArchiveColumns,
  type BookingArchiveColumnId,
} from "@/lib/booking/archiveColumns";

type FilterOptionApiItem = {
  id: string;
  name: string;
  email?: string | null;
  warehouseEmail?: string | null;
};

type OrdersApiResponse = {
  ok?: boolean;
  orders?: OrderRow[];
};

export default function BookingPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const access = useMemo(
    () => getBookingArchiveAccess(currentUser),
    [currentUser],
  );

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [appliedFilters, setAppliedFilters] = useState<BookingArchiveFilters>(
    DEFAULT_BOOKING_ARCHIVE_FILTERS,
  );
  const [filterPanelVersion, setFilterPanelVersion] = useState(0);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [emailOrder, setEmailOrder] = useState<OrderRow | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [columnModalOpen, setColumnModalOpen] = useState(false);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [visibleColumnIds, setVisibleColumnIds] = useState<
    BookingArchiveColumnId[]
  >(() => getDefaultVisibleBookingArchiveColumns(access.viewMode));

  const [subcontractors, setSubcontractors] = useState<BookingArchiveOption[]>(
    [],
  );
  const [creators, setCreators] = useState<BookingArchiveOption[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [customerActionLoading, setCustomerActionLoading] = useState(false);
  const [customerActionError, setCustomerActionError] = useState("");
  const [gsmDuplicateWarning, setGsmDuplicateWarning] = useState<string[]>([]);
  const gsmDuplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderLoadRequestIdRef = useRef(0);
  const orderLoadAbortRef = useRef<AbortController | null>(null);
  const lastLoadedAtRef = useRef(new Date().toISOString());
  const [changeFlags, setChangeFlags] = useState({ hasNewOrders: false, hasChangedOrders: false });

  async function loadOrders(
    filters: BookingArchiveFilters = appliedFilters,
  ): Promise<boolean> {
    const requestId = orderLoadRequestIdRef.current + 1;
    orderLoadRequestIdRef.current = requestId;
    orderLoadAbortRef.current?.abort();

    const abortController = new AbortController();
    orderLoadAbortRef.current = abortController;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (filters.status) params.set("status", filters.status);
      if (filters.subcontractorId)
        params.set("subcontractorId", filters.subcontractorId);
      if (filters.createdById) params.set("createdById", filters.createdById);
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.search) params.set("search", filters.search);

      params.set("page", String(filters.page));
      params.set("rowsPerPage", String(filters.rowsPerPage));

      const res = await fetch(`/api/orders?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: abortController.signal,
      });

      const data = (await res.json().catch(() => null)) as OrdersApiResponse | null;

      if (
        abortController.signal.aborted ||
        requestId !== orderLoadRequestIdRef.current
      ) {
        return false;
      }

      if (!res.ok || !data?.ok) {
        setError(bookingText(locale, "failed to load orders"));
        setOrders([]);
        setSelectedOrderIds([]);
        return false;
      }

      const nextOrders = data.orders ?? [];
      setOrders(nextOrders);
      lastLoadedAtRef.current = new Date().toISOString();
      setChangeFlags({ hasNewOrders: false, hasChangedOrders: false });

      setSelectedOrderIds((prev) =>
        prev.filter((id) =>
          nextOrders.some((order: OrderRow) => order.id === id),
        ),
      );
      return true;
    } catch {
      if (
        abortController.signal.aborted ||
        requestId !== orderLoadRequestIdRef.current
      ) {
        return false;
      }

      setError(bookingText(locale, "failed to load orders"));
      setOrders([]);
      setSelectedOrderIds([]);
      return false;
    } finally {
      if (requestId === orderLoadRequestIdRef.current) {
        setLoading(false);
        if (orderLoadAbortRef.current === abortController) {
          orderLoadAbortRef.current = null;
        }
      }
    }
  }

  async function loadFilterOptions() {
    try {
      const [subsRes, creatorsRes] = await Promise.all([
        fetch("/api/auth/subcontractors", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/auth/order-creators", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const subsData = await subsRes.json().catch(() => null);
      const creatorsData = await creatorsRes.json().catch(() => null);

      if (subsRes.ok && subsData?.ok) {
        setSubcontractors(
          (subsData.subcontractors ?? []).map((item: FilterOptionApiItem) => ({
            id: item.id,
            label: item.name,
          })),
        );
      }

      if (creatorsRes.ok && creatorsData?.ok) {
        setCreators(
          (creatorsData.orderCreators ?? []).map(
            (item: FilterOptionApiItem) => ({
              id: item.id,
              label: item.name,
              email: item.email ?? "",
              warehouseEmail: item.warehouseEmail ?? "",
            }),
          ),
        );
      }
    } catch {
      setSubcontractors([]);
      setCreators([]);
    }
  }

  async function handleBulkApply(payload: {
    status?: string;
    subcontractorId?: string;
  }): Promise<boolean> {
    if (selectedOrderIds.length === 0) return false;

    try {
      setBulkLoading(true);
      setBulkError("");
      setError("");

      const res = await fetch("/api/orders/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          ...payload,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setBulkError(data?.reason || "Failed to bulk update orders");
        return false;
      }

      setSelectedOrderIds([]);
      await loadOrders(appliedFilters);
      return true;
    } catch {
      setBulkError("Failed to bulk update orders");
      return false;
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleSendSelectedEmail(payload: {
    recipients: Array<{
      email: string;
      name?: string;
    }>;
    subject: string;
    message?: string;
    recipientName?: string;
  }): Promise<boolean> {
    if (payload.recipients.length === 0 || selectedOrderIds.length === 0) {
      return false;
    }

    try {
      setCustomerActionLoading(true);
      setCustomerActionError("");

      const res = await fetch("/api/orders/send-selected-email", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          recipients: payload.recipients,
          subject: payload.subject,
          message: payload.message,
          recipientName: payload.recipientName,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCustomerActionError(data?.reason || "Failed to send email");
        return false;
      }

      setSelectedOrderIds([]);
      return true;
    } catch {
      setCustomerActionError("Failed to send email");
      return false;
    } finally {
      setCustomerActionLoading(false);
    }
  }

  async function handleSendSelectedToGsm(): Promise<boolean> {
    if (selectedOrderIds.length === 0) return false;

    try {
      setCustomerActionLoading(true);
      setCustomerActionError("");

      const res = await fetch("/api/orders/send-to-gsm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrderIds }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCustomerActionError(data?.reason || "Failed to send to GSM");
        return false;
      }

      const results: Array<{ ok: boolean; orderNumber?: string; wasAlreadySent?: boolean }> =
        Array.isArray(data.results) ? data.results : [];

      const duplicates = results
        .filter((r) => r.ok && r.wasAlreadySent)
        .map((r) => r.orderNumber ?? "unknown");

      if (duplicates.length > 0) {
        if (gsmDuplicateTimerRef.current) clearTimeout(gsmDuplicateTimerRef.current);
        setGsmDuplicateWarning(duplicates);
        gsmDuplicateTimerRef.current = setTimeout(() => setGsmDuplicateWarning([]), 2 * 60 * 1000);
      }

      const successCount = results.filter((r) => r.ok).length;

      if (successCount > 0) {
        setSelectedOrderIds([]);
        await loadOrders(appliedFilters);
        return true;
      }

      setCustomerActionError("No orders were sent to GSM");
      return false;
    } catch {
      setCustomerActionError("Failed to send to GSM");
      return false;
    } finally {
      setCustomerActionLoading(false);
    }
  }

  async function handleCopySelected() {
    if (selectedOrderIds.length === 0) return;

    try {
      setCustomerActionLoading(true);
      setCustomerActionError("");

      const res = await fetch("/api/orders/duplicate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCustomerActionError(
          data?.reason || "Failed to copy selected orders",
        );
        return;
      }

      setSelectedOrderIds([]);
      await loadOrders(appliedFilters);
    } catch {
      setCustomerActionError("Failed to copy selected orders");
    } finally {
      setCustomerActionLoading(false);
    }
  }

  function handleExportSelected() {
    if (selectedOrderIds.length === 0) return;

    exportOrdersToExcel({
      rows: orders,
      selectedIds: selectedOrderIds,
      viewMode: access.viewMode,
      visibleColumnIds,
    });
  }

  useEffect(() => {
    const defaultColumns = getDefaultVisibleBookingArchiveColumns(access.viewMode);
    const storageKey = getBookingArchiveVisibilityStorageKey(access.viewMode);
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      setVisibleColumnIds(defaultColumns);
      return;
    }

    try {
      const parsedValue: unknown = JSON.parse(storedValue);

      if (Array.isArray(parsedValue)) {
        const storedColumnIds = parsedValue.filter(
          (columnId): columnId is string => typeof columnId === "string",
        );
        setVisibleColumnIds(
          sanitizeVisibleBookingArchiveColumns(access.viewMode, storedColumnIds),
        );
        return;
      }
    } catch {
      // Ignore invalid persisted column state.
    }

    setVisibleColumnIds(defaultColumns);
  }, [access.viewMode]);

  useEffect(() => {
    const storageKey = getBookingArchiveVisibilityStorageKey(access.viewMode);
    window.localStorage.setItem(storageKey, JSON.stringify(visibleColumnIds));
  }, [access.viewMode, visibleColumnIds]);

  useEffect(() => {
    void loadOrders(DEFAULT_BOOKING_ARCHIVE_FILTERS);
    void loadFilterOptions();
    return () => {
      orderLoadAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (access.viewMode !== "ADMIN") return;

    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/auth/heartbeat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastChecked: lastLoadedAtRef.current }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.ok) {
          setChangeFlags({
            hasNewOrders: !!data.hasNewOrders,
            hasChangedOrders: !!data.hasChangedOrders,
          });
        }
      } catch {
        // silently ignore heartbeat errors
      }
    };

    const initialTimer = setTimeout(check, 3_000);
    const interval = setInterval(check, 60_000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [access.viewMode]);

  function handleApplyFilters(next: BookingArchiveFilters) {
    setAppliedFilters(next);
    void loadOrders(next);
  }

  function handleResetFilters() {
    setAppliedFilters(DEFAULT_BOOKING_ARCHIVE_FILTERS);
    setFilterPanelVersion((prev) => prev + 1);
    void loadOrders(DEFAULT_BOOKING_ARCHIVE_FILTERS);
  }

  function handleToggleOrder(orderId: string) {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  }

  function handleToggleAllVisible() {
    const visibleIds = orders.map((order) => order.id);

    setSelectedOrderIds((prev) => {
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.includes(id));

      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }

  function handleToggleVisibleColumn(columnId: BookingArchiveColumnId) {
    setVisibleColumnIds((prev) => {
      const isVisible = prev.includes(columnId);

      if (isVisible) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== columnId);
      }

      const next = [...prev, columnId];
      return sanitizeVisibleBookingArchiveColumns(access.viewMode, next);
    });
  }

  function handleResetVisibleColumns() {
    setVisibleColumnIds(getDefaultVisibleBookingArchiveColumns(access.viewMode));
  }

  const canBulkSelect = access.viewMode === "ADMIN";
  const canSelectOrders =
    access.viewMode === "ADMIN" ||
    access.viewMode === "SUBCONTRACTOR" ||
    access.viewMode === "ORDER_CREATOR";
  const selectedOrderIdSet = new Set(selectedOrderIds);
  const selectedPriceExVatTotal = orders.reduce((sum, order) => {
    if (!selectedOrderIdSet.has(order.id)) return sum;
    if (typeof order.priceExVat !== "number") return sum;
    return sum + order.priceExVat;
  }, 0);
  const selectedPriceExVatLabel = selectedPriceExVatTotal.toLocaleString(
    "no-NO",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  );

  return (
    <div className="w-full">
      <h1 className="mb-10 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl text-weird-landscape-large margin-weird-landscape">
        {bookingText(locale, "Booking orders")}
      </h1>

      <div className="flex flex-col gap-3  padding-weird-landscape">
        <BookingFilters
          key={`${filterPanelVersion}:${access.lockedCreatedById ?? ""}:${access.lockedSubcontractorId ?? ""}`}
          initialApplied={appliedFilters}
          access={access}
          subcontractors={subcontractors}
          creators={creators}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          onRefresh={() => void loadOrders(appliedFilters)}
          displayedOrderCount={!loading && !error ? orders.length : undefined}
          locale={locale}
        />
      </div>

      {access.viewMode === "ADMIN" && (
        <div className="max-w-[1000]">
          <BulkUpdateBar
            selectedCount={selectedOrderIds.length}
            subcontractors={subcontractors}
            onApply={handleBulkApply}
            onClear={() => setSelectedOrderIds([])}
            loading={bulkLoading}
            error={bulkError}
            locale={locale}
          />

          <SelectionActionBar
            creators={creators}
            selectedCount={selectedOrderIds.length}
            onSendEmail={handleSendSelectedEmail}
            onSendGsm={() => handleSendSelectedToGsm()}
            onCopySelected={handleCopySelected}
            onExportExcel={handleExportSelected}
            onManageColumns={() => setColumnModalOpen(true)}
            loading={customerActionLoading}
            error={customerActionError}
            gsmDuplicateWarning={gsmDuplicateWarning}
          />
        </div>
      )}
      <div className="min-w-0 w-full overflow-x-auto">
        <div className="min-w-0 w-full">
          <div className="relative my-4 flex items-center justify-between gap-2">
            <div className="my-2 flex flex-col items-start gap-2">
              {access.viewMode !== "ADMIN" ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="customButtonDefault" onClick={() => setColumnModalOpen(true)}>
                    {bookingText(locale, "Hide columns")}
                  </button>

                  <button
                    type="button"
                    className="customButtonDefault disabled:opacity-50! disabled:cursor-auto!"
                    onClick={handleExportSelected}
                    disabled={selectedOrderIds.length === 0}
                  >
                    Last ned valgte ({selectedOrderIds.length})
                  </button>
                </div>
              ) : null}

              <div className="text-sm text-textColorThird">
                {canSelectOrders
                  ? `${selectedOrderIds.length} ${bookingText(locale, "selected")} - ${bookingText(locale, "Price ex. VAT")}: NOK ${selectedPriceExVatLabel}`
                  : ""}
              </div>
            </div>

            {access.viewMode === "ADMIN" && (
              <div className=" absolute left-56 items-start gap-1 w-60">
                <button
                  type="button"
                  className={`customButtonDefault${changeFlags.hasNewOrders || changeFlags.hasChangedOrders ? " bg-red-600! text-white! border-red-600!" : ""}`}
                  onClick={() => void loadOrders(appliedFilters)}
                  disabled={loading}
                >
                  {bookingText(locale, "Refresh")}
                </button>

                <span className={`text-xs font-medium pl-4 ${changeFlags.hasNewOrders || changeFlags.hasChangedOrders ? " text-red-600" : " text-textColorThird"}`}>
                  {changeFlags.hasNewOrders && changeFlags.hasChangedOrders
                    ? `${bookingText(locale, "New order")} · ${bookingText(locale, "Order changed")}`
                    : changeFlags.hasNewOrders
                      ? bookingText(locale, "New order")
                      : changeFlags.hasChangedOrders
                        ? bookingText(locale, "Order changed")
                        : bookingText(locale, "Up to date")}
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-6 text-textColorThird">{bookingText(locale, "Loading orders...")}</div>
          ) : error ? (
            <div className="py-6 text-red-600">{error}</div>
          ) : (
            <BookingArchiveTable
              orders={orders}
              viewMode={access.viewMode}
              onRowClick={(orderId) => {
                setSelectedOrderId(orderId);
                setModalOpen(true);
              }}
              onAlertClick={(order) => {
                setEmailOrder(order);
                setEmailModalOpen(true);
              }}
              selectable={canSelectOrders}
              selectedOrderIds={selectedOrderIds}
              onToggleOrder={handleToggleOrder}
              onToggleAllVisible={handleToggleAllVisible}
              visibleColumnIds={visibleColumnIds}
              locale={locale}
            />
          )}
        </div>
      </div>

      <OrderModal
        orderId={selectedOrderId}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOrderId(null);
        }}
        onSaved={() => void loadOrders(appliedFilters)}
        canDelete={access.viewMode === "ADMIN"}
        locale={locale}
        onDeleted={() => {
          setModalOpen(false);
          setSelectedOrderId(null);
          void loadOrders(appliedFilters);
        }}
      />

      <OrderEmailModal
        open={emailModalOpen}
        order={emailOrder}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailOrder(null);
        }}
        onAlertsChanged={() => void loadOrders(appliedFilters)}
      />

      <BookingColumnVisibilityModal
        open={columnModalOpen}
        viewMode={access.viewMode}
        visibleColumnIds={visibleColumnIds}
        onToggleColumn={handleToggleVisibleColumn}
        onReset={handleResetVisibleColumns}
        onClose={() => setColumnModalOpen(false)}
      />
    </div>
  );
}

