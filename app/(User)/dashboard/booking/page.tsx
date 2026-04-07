"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import OrderModal from "@/app/_components/Dahsboard/booking/OrderModal";
import BookingFilters from "@/app/_components/Dahsboard/booking/archive/BookingFilters";
import BookingArchiveTable from "@/app/_components/Dahsboard/booking/archive/BookingArchiveTable";
import type {
  BookingArchiveFilters,
  BookingArchiveOption,
  OrderRow,
} from "@/app/_components/Dahsboard/booking/archive/types";
import { DEFAULT_BOOKING_ARCHIVE_FILTERS } from "@/lib/orders/archiveFilters";
import { getBookingArchiveAccess } from "@/lib/orders/archiveAccess";
import BulkUpdateBar from "@/app/_components/Dahsboard/booking/archive/BulkUpdateBar";
import SelectionActionBar from "@/app/_components/Dahsboard/booking/archive/SelectionActionBar";
import { exportOrdersToExcel } from "@/lib/booking/exportOrdersToExcel";

type FilterOptionApiItem = {
  id: string;
  name: string;
  email?: string | null;
};

export default function BookingPage() {
  const currentUser = useCurrentUser();
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

  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [subcontractors, setSubcontractors] = useState<BookingArchiveOption[]>(
    [],
  );
  const [creators, setCreators] = useState<BookingArchiveOption[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [customerActionLoading, setCustomerActionLoading] = useState(false);
  const [customerActionError, setCustomerActionError] = useState("");
  const [gsmResendAvailable, setGsmResendAvailable] = useState(false);

  async function loadOrders(filters: BookingArchiveFilters = appliedFilters) {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (filters.status) params.set("status", filters.status);
      if (filters.subcontractorId)
        params.set("subcontractorId", filters.subcontractorId);
      if (filters.customerMembershipId)
        params.set("customerMembershipId", filters.customerMembershipId);
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.search) params.set("search", filters.search);

      if (sortBy) params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      params.set("page", String(filters.page));
      params.set("rowsPerPage", String(filters.rowsPerPage));

      const res = await fetch(`/api/orders?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError("Failed to load orders");
        setOrders([]);
        setSelectedOrderIds([]);
        return;
      }

      const nextOrders = data.orders ?? [];
      setOrders(nextOrders);

      setSelectedOrderIds((prev) =>
        prev.filter((id) =>
          nextOrders.some((order: OrderRow) => order.id === id),
        ),
      );
    } catch {
      setError("Failed to load orders");
      setOrders([]);
      setSelectedOrderIds([]);
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
    to: string;
    subject: string;
    message?: string;
    recipientName?: string;
  }): Promise<boolean> {
    if (!payload.to || selectedOrderIds.length === 0) return false;

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
          to: payload.to,
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

  async function handleSendSelectedToGsm(force = false): Promise<boolean> {
    if (selectedOrderIds.length === 0) return false;

    try {
      setCustomerActionLoading(true);
      setCustomerActionError("");
      setGsmResendAvailable(false);

      const res = await fetch("/api/orders/send-to-gsm", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          force,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCustomerActionError(data?.reason || "Failed to send to GSM");
        return false;
      }

      const results = Array.isArray(data.results) ? data.results : [];
      const successCount = results.filter(
        (item: { ok: boolean }) => item.ok,
      ).length;

      const alreadySentCount = results.filter(
        (item: { error?: string }) => item.error === "ALREADY_SENT_TO_GSM",
      ).length;

      const failedCount = results.filter(
        (item: { ok: boolean; error?: string }) =>
          !item.ok && item.error !== "ALREADY_SENT_TO_GSM",
      ).length;

      if (
        alreadySentCount > 0 &&
        successCount === 0 &&
        failedCount === 0 &&
        !force
      ) {
        setCustomerActionError(
          `${alreadySentCount} selected order(s) were already sent to GSM.`,
        );
        setGsmResendAvailable(true);
        return false;
      }

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
    });
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

  const canBulkSelect = access.viewMode === "ADMIN";

  return (
    <div className="w-full">
      <h1 className="mb-10 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
        Booking orders
      </h1>

      <div className="flex flex-col gap-3 pb-4">
        <BookingFilters
          initialApplied={appliedFilters}
          access={access}
          subcontractors={subcontractors}
          creators={creators}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          onRefresh={() => void loadOrders(appliedFilters)}
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
          />

          <SelectionActionBar
            customers={creators}
            selectedCount={selectedOrderIds.length}
            onSendEmail={handleSendSelectedEmail}
            onSendGsm={() => handleSendSelectedToGsm(false)}
            onResendGsm={() => handleSendSelectedToGsm(true)}
            showResendGsm={gsmResendAvailable}
            onCopySelected={handleCopySelected}
            onExportExcel={handleExportSelected}
            loading={customerActionLoading}
            error={customerActionError}
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <div className=" max-w-[4000]">
          <div className="flex items-center justify-between gap-2 my-4">
            <div className="text-sm text-textColorThird my-2">
              {canBulkSelect ? `${selectedOrderIds.length} selected` : ""}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <select
                className="customInput cursor-pointer w-48"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  void loadOrders();
                }}
              >
                <option value="">Sort</option>
                <option value="deliveryDate">Delivery date</option>
                <option value="price">Price</option>
                <option value="status">Status</option>
              </select>

              <button
                type="button"
                className="customButtonDefault"
                onClick={() => {
                  setSortOrder((prev) => {
                    const next = prev === "asc" ? "desc" : "asc";
                    setTimeout(() => void loadOrders(), 0);
                    return next;
                  });
                }}
              >
                {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-6 text-textColorThird">Loading orders...</div>
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
              selectable={canBulkSelect}
              selectedOrderIds={selectedOrderIds}
              onToggleOrder={handleToggleOrder}
              onToggleAllVisible={handleToggleAllVisible}
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
        onDeleted={() => {
          setModalOpen(false);
          setSelectedOrderId(null);
          void loadOrders(appliedFilters);
        }}
      />
    </div>
  );
}
