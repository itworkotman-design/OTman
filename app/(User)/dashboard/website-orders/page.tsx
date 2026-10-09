"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { bookingText } from "@/lib/booking/bookingUiText";
import {
  getSelectedArchiveOrdersPriceTotal,
  getWebsiteOrdersColumns,
  getWebsiteOrdersVisibilityStorageKey,
  getWebsiteOrdersVisibleColumns,
  sanitizeWebsiteOrdersVisibleColumns,
  type BookingArchiveColumnId,
} from "@/lib/booking/archiveColumns";
import { exportOrdersToExcel } from "@/lib/booking/exportOrdersToExcel";
import { DEFAULT_BOOKING_ARCHIVE_FILTERS } from "@/lib/orders/archiveFilters";
import { WEBSITE_ORDER_STATUS_OPTIONS } from "@/lib/orders/statusPresentation";
import BookingArchiveTable from "@/app/_components/Dahsboard/booking/archive/BookingArchiveTable";
import BookingFilters from "@/app/_components/Dahsboard/booking/archive/BookingFilters";
import BulkUpdateBar from "@/app/_components/Dahsboard/booking/archive/BulkUpdateBar";
import SelectionActionBar from "@/app/_components/Dahsboard/booking/archive/SelectionActionBar";
import BookingColumnVisibilityModal from "@/app/_components/Dahsboard/booking/archive/BookingColumnVisibilityModal";
import DashboardOrderModal from "@/app/_components/Dahsboard/booking/DashboardOrderModal";
import OrderEmailModal from "@/app/_components/Dahsboard/booking/archive/OrderEmailModal";
import ShiftLeaderBanner from "@/app/_components/Dahsboard/booking/ShiftLeaderBanner";
import type { BookingArchiveFilters, BookingArchiveOption, OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";

// Same tooling as the main orders page, minus everything that only makes sense
// for B2B store orders: store/pricelist/pickup-address filters, the store
// "prepare orders" email, Copy selected (a copy would lose the website-order
// flag, public order number and customer login) and delete.
const WEBSITE_FILTER_ACCESS = { canFilterCreatedBy: false, canFilterSubcontractor: true };
const WEBSITE_ORDER_COLUMNS = getWebsiteOrdersColumns();

type OrdersApiResponse = {
  ok?: boolean;
  orders?: OrderRow[];
};

export default function WebsiteOrdersPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const hasWebsiteOrdersAccess = currentUser ? getModuleAccess(currentUser, "WEBSITE_ORDERS").enabled : false;

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [appliedFilters, setAppliedFilters] = useState<BookingArchiveFilters>(DEFAULT_BOOKING_ARCHIVE_FILTERS);
  const [filterPanelVersion, setFilterPanelVersion] = useState(0);
  const [subcontractors, setSubcontractors] = useState<BookingArchiveOption[]>([]);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const selectedOrders = useMemo(() => {
    const selected = new Set(selectedOrderIds);
    return orders.filter((order) => selected.has(order.id));
  }, [orders, selectedOrderIds]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [emailOrder, setEmailOrder] = useState<OrderRow | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<BookingArchiveColumnId[]>(() => getWebsiteOrdersVisibleColumns());

  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [gsmDuplicateWarning, setGsmDuplicateWarning] = useState<string[]>([]);
  const gsmDuplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderLoadRequestIdRef = useRef(0);
  const orderLoadAbortRef = useRef<AbortController | null>(null);
  const lastLoadedAtRef = useRef(new Date().toISOString());
  const [changeFlags, setChangeFlags] = useState({ hasNewOrders: false, hasChangedOrders: false });

  async function loadOrders(filters: BookingArchiveFilters = appliedFilters): Promise<boolean> {
    const requestId = orderLoadRequestIdRef.current + 1;
    orderLoadRequestIdRef.current = requestId;
    orderLoadAbortRef.current?.abort();

    const abortController = new AbortController();
    orderLoadAbortRef.current = abortController;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ isWebsiteOrder: "true" });
      if (filters.status) params.set("status", filters.status);
      if (filters.subcontractorId) params.set("subcontractorId", filters.subcontractorId);
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

      if (abortController.signal.aborted || requestId !== orderLoadRequestIdRef.current) return false;

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
      setSelectedOrderIds((prev) => prev.filter((id) => nextOrders.some((o) => o.id === id)));
      return true;
    } catch {
      if (abortController.signal.aborted || requestId !== orderLoadRequestIdRef.current) return false;

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

  async function loadSubcontractors() {
    try {
      const res = await fetch("/api/auth/subcontractors", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        setSubcontractors(
          (data.subcontractors ?? []).map((item: { id: string; name: string }) => ({
            id: item.id,
            label: item.name,
          })),
        );
      }
    } catch {
      setSubcontractors([]);
    }
  }

  useEffect(() => {
    void loadOrders(DEFAULT_BOOKING_ARCHIVE_FILTERS);
    void loadSubcontractors();
    return () => {
      orderLoadAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(getWebsiteOrdersVisibilityStorageKey());
      if (!storedValue) return;

      const parsedValue: unknown = JSON.parse(storedValue);
      if (Array.isArray(parsedValue)) {
        setVisibleColumnIds(
          sanitizeWebsiteOrdersVisibleColumns(parsedValue.filter((columnId): columnId is string => typeof columnId === "string")),
        );
      }
    } catch {
      // Ignore invalid or unavailable persisted column state.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(getWebsiteOrdersVisibilityStorageKey(), JSON.stringify(visibleColumnIds));
    } catch {
      // Storage can be unavailable (private mode); the layout just won't persist.
    }
  }, [visibleColumnIds]);

  useEffect(() => {
    if (!hasWebsiteOrdersAccess) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/auth/heartbeat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastChecked: lastLoadedAtRef.current, websiteOrdersOnly: true }),
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
  }, [hasWebsiteOrdersAccess]);

  async function handleBulkApply(payload: { status?: string; statusNotes?: string; subcontractorId?: string }): Promise<boolean> {
    if (selectedOrderIds.length === 0) return false;

    try {
      setBulkLoading(true);
      setBulkError("");
      setError("");

      const res = await fetch("/api/orders/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrderIds, ...payload }),
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

  async function handleSendSelectedToGsm(): Promise<boolean> {
    if (selectedOrderIds.length === 0) return false;

    try {
      setSelectionLoading(true);
      setSelectionError("");

      const res = await fetch("/api/orders/send-to-gsm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrderIds }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setSelectionError(data?.reason || "Failed to send to GSM");
        return false;
      }

      const results: Array<{ ok: boolean; orderNumber?: string; wasAlreadySent?: boolean }> = Array.isArray(data.results) ? data.results : [];

      const duplicates = results.filter((r) => r.ok && r.wasAlreadySent).map((r) => r.orderNumber ?? "unknown");

      if (duplicates.length > 0) {
        if (gsmDuplicateTimerRef.current) clearTimeout(gsmDuplicateTimerRef.current);
        setGsmDuplicateWarning(duplicates);
        gsmDuplicateTimerRef.current = setTimeout(() => setGsmDuplicateWarning([]), 2 * 60 * 1000);
      }

      if (results.some((r) => r.ok)) {
        setChangeFlags((prev) => ({ ...prev, hasChangedOrders: true }));
        return true;
      }

      setSelectionError("No orders were sent to GSM");
      return false;
    } catch {
      setSelectionError("Failed to send to GSM");
      return false;
    } finally {
      setSelectionLoading(false);
    }
  }

  function handleExportSelected() {
    if (selectedOrderIds.length === 0) return;

    exportOrdersToExcel({
      rows: orders,
      selectedIds: selectedOrderIds,
      viewMode: "ADMIN",
      visibleColumnIds,
    });
  }

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

  function handleToggleVisibleColumn(columnId: BookingArchiveColumnId) {
    setVisibleColumnIds((prev) => {
      if (prev.includes(columnId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== columnId);
      }
      return sanitizeWebsiteOrdersVisibleColumns([...prev, columnId]);
    });
  }

  if (!hasWebsiteOrdersAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">{bookingText(locale, "You do not have access to create orders.")}</p>
      </div>
    );
  }

  const selectedPriceLabel = getSelectedArchiveOrdersPriceTotal(orders, selectedOrderIds, "ADMIN").toLocaleString("no-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const hasChanges = changeFlags.hasNewOrders || changeFlags.hasChangedOrders;

  return (
    <div className="w-full">
      <div className="mb-4 sm:mb-10">
        <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
          {locale === "nb" ? "Nettsidebestillinger" : "Website orders"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-textColorThird">
          {locale === "nb"
            ? "Bestillinger sendt inn av privatkunder via nettsiden."
            : "Orders submitted by private customers through the website."}
        </p>
      </div>

      <ShiftLeaderBanner currentUserId={currentUser?.id} />

      <div className="flex w-full sm:w-fit max-w-full flex-col items-stretch gap-3 padding-weird-landscape">
        <BookingFilters
          key={filterPanelVersion}
          initialApplied={appliedFilters}
          access={WEBSITE_FILTER_ACCESS}
          subcontractors={subcontractors}
          creators={[]}
          statusOptions={WEBSITE_ORDER_STATUS_OPTIONS}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          onRefresh={() => void loadOrders(appliedFilters)}
          displayedOrderCount={!loading && !error ? orders.length : undefined}
          locale={locale}
        />

        <BulkUpdateBar
          selectedCount={selectedOrderIds.length}
          selectedOrders={selectedOrders}
          subcontractors={subcontractors}
          statusOptions={WEBSITE_ORDER_STATUS_OPTIONS}
          onApply={handleBulkApply}
          onClear={() => setSelectedOrderIds([])}
          loading={bulkLoading}
          error={bulkError}
          locale={locale}
        />

        <SelectionActionBar
          creators={[]}
          selectedCount={selectedOrderIds.length}
          locale={locale}
          onSendGsm={() => handleSendSelectedToGsm()}
          onExportExcel={handleExportSelected}
          onManageColumns={() => setColumnModalOpen(true)}
          loading={selectionLoading}
          error={selectionError}
          gsmDuplicateWarning={gsmDuplicateWarning}
        />
      </div>

      <div className="min-w-0 w-full overflow-x-auto">
        <div className="min-w-0 w-full">
          <div className="relative my-4 flex items-center gap-2">
            <div className="my-2 text-sm text-textColorThird">
              {`${selectedOrderIds.length} ${bookingText(locale, "selected")} - ${bookingText(locale, "Price ex. VAT")}: NOK ${selectedPriceLabel}`}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className={`customButtonDefault${hasChanges ? " bg-red-600! text-white! border-red-600!" : ""}`}
                onClick={() => void loadOrders(appliedFilters)}
                disabled={loading}
              >
                {bookingText(locale, "Refresh")}
              </button>

              <span className={`text-xs font-medium ${hasChanges ? " text-red-600" : " text-textColorThird"}`}>
                {changeFlags.hasNewOrders && changeFlags.hasChangedOrders
                  ? `${bookingText(locale, "New order")} · ${bookingText(locale, "Order changed")}`
                  : changeFlags.hasNewOrders
                    ? bookingText(locale, "New order")
                    : changeFlags.hasChangedOrders
                      ? bookingText(locale, "Order changed")
                      : bookingText(locale, "Up to date")}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-6 text-textColorThird">{bookingText(locale, "Loading orders...")}</div>
          ) : error ? (
            <div className="py-6 text-red-600">{error}</div>
          ) : orders.length === 0 ? (
            <div className="py-6 text-textColorThird">{bookingText(locale, "No orders found")}</div>
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
              visibleColumnIds={visibleColumnIds}
              locale={locale}
            />
          )}
        </div>
      </div>

      <DashboardOrderModal
        orderId={selectedOrderId}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOrderId(null);
        }}
        onSaved={() => void loadOrders(appliedFilters)}
        canDelete={false}
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
        viewMode="ADMIN"
        columns={WEBSITE_ORDER_COLUMNS}
        visibleColumnIds={visibleColumnIds}
        onToggleColumn={handleToggleVisibleColumn}
        onReset={() => setVisibleColumnIds(getWebsiteOrdersVisibleColumns())}
        onClose={() => setColumnModalOpen(false)}
      />
    </div>
  );
}
