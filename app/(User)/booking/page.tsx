"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import BookingFilters from "@/app/_components/Dahsboard/booking/archive/BookingFilters";
import BookingArchiveTable from "@/app/_components/Dahsboard/booking/archive/BookingArchiveTable";
import ReadOnlyOrderModal from "@/app/_components/Dahsboard/booking/orders/ReadOnlyOrderModal";
import type { BookingArchiveFilters, BookingArchiveOption, OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";
import { DEFAULT_BOOKING_ARCHIVE_FILTERS } from "@/lib/orders/archiveFilters";
import { getBookingArchiveAccess } from "@/lib/orders/archiveAccess";
import { bookingText } from "@/lib/booking/bookingUiText";
import { useUserLanguage } from "@/lib/users/language";
import  OrderCreatorContactModal  from "@/app/_components/Dahsboard/booking/orders/OrderCreatorContactModal";
import { exportVisibleOrdersToExcel } from "@/lib/booking/exportOrdersToExcel";
import { getDefaultVisibleBookingArchiveColumns } from "@/lib/booking/archiveColumns";


type FilterOptionApiItem = {
  id: string;
  name: string;
};

type OrdersResponse = {
  ok: boolean;
  orders?: OrderRow[];
  reason?: string;
};

type SubcontractorsResponse = {
  ok: boolean;
  subcontractors?: FilterOptionApiItem[];
};

type OrderCreatorsResponse = {
  ok: boolean;
  orderCreators?: FilterOptionApiItem[];
};

export default function BookingPage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const access = useMemo(() => getBookingArchiveAccess(currentUser), [currentUser]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [appliedFilters, setAppliedFilters] = useState<BookingArchiveFilters>(DEFAULT_BOOKING_ARCHIVE_FILTERS);
  const [filterPanelVersion, setFilterPanelVersion] = useState(0);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactOrder, setContactOrder] = useState<OrderRow | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const [subcontractors, setSubcontractors] = useState<BookingArchiveOption[]>([]);
  const [creators, setCreators] = useState<BookingArchiveOption[]>([]);

  async function loadOrders(filters: BookingArchiveFilters = appliedFilters) {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (filters.status) params.set("status", filters.status);
      if (filters.subcontractorId) {
        params.set("subcontractorId", filters.subcontractorId);
      }
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
      });

      const data = (await res.json().catch(() => null)) as OrdersResponse | null;

      if (!res.ok || !data?.ok) {
        setError(bookingText(locale, data?.reason || "failed to load orders"));
        setOrders([]);
        return;
      }

      setOrders(data.orders ?? []);
    } catch {
      setError(bookingText(locale, "failed to load orders"));
      setOrders([]);
    } finally {
      setLoading(false);
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

      const subsData = (await subsRes.json().catch(() => null)) as SubcontractorsResponse | null;
      const creatorsData = (await creatorsRes.json().catch(() => null)) as OrderCreatorsResponse | null;

      if (subsRes.ok && subsData?.ok) {
        setSubcontractors(
          (subsData.subcontractors ?? []).map((item) => ({
            id: item.id,
            label: item.name,
          })),
        );
      } else {
        setSubcontractors([]);
      }

      if (creatorsRes.ok && creatorsData?.ok) {
        setCreators(
          (creatorsData.orderCreators ?? []).map((item) => ({
            id: item.id,
            label: item.name,
          })),
        );
      } else {
        setCreators([]);
      }
    } catch {
      setSubcontractors([]);
      setCreators([]);
    }
  }

  useEffect(() => {
    void loadOrders(DEFAULT_BOOKING_ARCHIVE_FILTERS);
    void loadFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplyFilters(next: BookingArchiveFilters) {
    setAppliedFilters(next);
    void loadOrders(next);
  }

  function handleResetFilters() {
    setAppliedFilters(DEFAULT_BOOKING_ARCHIVE_FILTERS);
    setFilterPanelVersion((prev) => prev + 1);
    void loadOrders(DEFAULT_BOOKING_ARCHIVE_FILTERS);
  }

  function handleDownloadVisibleTable() {
    void exportVisibleOrdersToExcel({
      rows: orders,
      viewMode: access.viewMode,
      visibleColumnIds: getDefaultVisibleBookingArchiveColumns(access.viewMode),
    });
  }

  if (!currentUser) return null;

  return (
    <div className="w-full">
      <h1 className="mb-10 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">{bookingText(locale, "Booking orders")}</h1>

      <div className="flex flex-col gap-3 pb-4">
        <BookingFilters
          key={`${filterPanelVersion}:${access.lockedCreatedById ?? ""}:${access.lockedSubcontractorId ?? ""}`}
          initialApplied={appliedFilters}
          access={access}
          subcontractors={subcontractors}
          creators={creators}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          onRefresh={() => void loadOrders(appliedFilters)}
          onDownloadVisibleTable={
            access.viewMode === "ORDER_CREATOR"
              ? handleDownloadVisibleTable
              : undefined
          }
          downloadVisibleTableDisabled={loading || orders.length === 0}
          locale={locale}
        />
      </div>

      <div className="min-w-0 w-full">
        <div className="min-w-0 w-full">
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
                setContactOrder(order);
                setContactModalOpen(true);
              }}
              selectable={false}
              selectedOrderIds={[]}
              onToggleOrder={() => {}}
              onToggleAllVisible={() => {}}
              locale={locale}
            />
          )}
        </div>
      </div>

      <ReadOnlyOrderModal
        open={modalOpen}
        viewMode={access.viewMode}
        order={selectedOrderId ? (orders.find((order) => order.id === selectedOrderId) ?? null) : null}
        onClose={() => {
          setModalOpen(false);
          setSelectedOrderId(null);
        }}
      />

      <OrderCreatorContactModal
        open={contactModalOpen}
        order={contactOrder}
        onClose={() => {
          setContactModalOpen(false);
          setContactOrder(null);
        }}
        onConversationChanged={() => void loadOrders(appliedFilters)}
      />
    </div>
  );
}
