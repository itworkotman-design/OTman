"use client";

import { useMemo, useState } from "react";

import TopFiltersField, {
  type AppliedFilters,
} from "../../_components/Dahsboard/booking/orders/TopFiltersField";
import { BookingFieldEditor } from "../../_components/Dahsboard/booking/orders/BookingFieldEditor";
import { MessageSender } from "../../_components/Dahsboard/booking/orders/MessageSender";
import { ArchiveTable } from "../../_components/Dahsboard/booking/orders/ArchiveTable";

import { ORDERS as MOCK_ORDERS } from "@/lib/_mockdb";
import type { OrderRow, OrderStatus } from "@/lib/_mockdb";

const DEFAULT_FILTERS: AppliedFilters = {
  status: "",
  client: "",
  subcontractor: "",
  fromDate: "",
  toDate: "",
  search: "",
  rowsPerPage: 5,
  page: 1,
};

export default function AllOrders() {
  // "DB" state for now (so updates rerender the table)
  const [orders, setOrders] = useState<OrderRow[]>(MOCK_ORDERS);

  // applied filters + selection
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // example employees
  const employees = [
    { id: "1", name: "Janis Otmans" },
    { id: "2", name: "Ralfs Kolveits" },
  ];

  /**
   * Options for BookingFieldEditor
   * - These are the dropdown items
   * - Later fetch these from DB
   */
  const statusOptions = useMemo(
    () =>
      [
        { value: "inProgress", label: "In progress" },
        { value: "confirmed", label: "Confirmed" },
        { value: "active", label: "Active" },
        { value: "cancelled", label: "Cancelled" },
        { value: "fail", label: "Fail" },
        { value: "completed", label: "Completed" },
        { value: "invoiced", label: "Invoiced" },
        { value: "betalt", label: "Paid" },
      ] as const,
    []
  );

  const subcontractorOptions = useMemo(
    () =>
      ["Sub A", "Sub B", "Sub C"].map((s) => ({ value: s, label: s })),
    []
  );

  const handleApplyFilters = (next: AppliedFilters) => {
    setAppliedFilters(next);
    setSelectedIds([]);
  };

  const handleResetFilters = () => {
    setAppliedFilters(DEFAULT_FILTERS);
    setSelectedIds([]);
  };

  /**
   * Bulk update actions:
   * - Use selectedIds to update the matching orders in state
   * - Clear selection afterwards
   */
  const onUpdateStatus = async (status: string) => {
    const nextStatus = status as OrderStatus;

    setOrders((prev) =>
      prev.map((o) => (selectedIds.includes(o.id) ? { ...o, status: nextStatus } : o))
    );

    setSelectedIds([]);
  };

  const onUpdateSubcontractor = async (subcontractorId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        selectedIds.includes(o.id) ? { ...o, subcontractor: subcontractorId } : o
      )
    );

    setSelectedIds([]);
  };

  const onUpdateDriverText = async (text: string) => {
    setOrders((prev) =>
      prev.map((o) => (selectedIds.includes(o.id) ? { ...o, driverInfo: text } : o))
    );

    setSelectedIds([]);
  };

  /*Messages*/
  const handleSendEmail = async (recipient: string, type: string) => {
    console.log("Send email:", { recipient, type, selectedIds });
  };

  const handleSendGSM = async (recipient: string) => {
    console.log("Send GSM:", { recipient, selectedIds });
  };

  const handleCopySelected = () => {
    console.log("Copy selected bookings:", selectedIds);
  };

  const handleExportExcel = () => {
    console.log("Export selected to Excel:", selectedIds);
  };

  return (
    <div>
      <TopFiltersField
        key={[
          appliedFilters.status,
          appliedFilters.client,
          appliedFilters.subcontractor,
          appliedFilters.fromDate,
          appliedFilters.toDate,
          appliedFilters.search,
          appliedFilters.rowsPerPage,
          appliedFilters.page,
        ].join("|")}
        initialApplied={appliedFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      <BookingFieldEditor
        selectedCount={selectedIds.length}
        statusOptions={statusOptions}
        subcontractorOptions={subcontractorOptions}
        onUpdateStatus={onUpdateStatus}
        onUpdateSubcontractor={onUpdateSubcontractor}
        onUpdateDriverText={onUpdateDriverText}
      />

      <MessageSender
        employees={employees}
        onSendEmail={(id, type) => handleSendEmail(id, type)}
        onSendGsm={(id) => handleSendGSM(id)}
        onCopySelected={handleCopySelected}
        onExportExcel={handleExportExcel}
      />

      <div className="flex-1 overflow-auto py-4">
        <ArchiveTable
          filters={appliedFilters}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          orders={orders}
        />
      </div>
    </div>
  );
}