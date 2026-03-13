"use client";

import { useMemo, useState } from "react";

import TopFiltersField, {
  type AppliedFilters,
} from "../../_components/Dahsboard/booking/orders/TopFiltersField";
import { BookingFieldEditor } from "../../_components/Dahsboard/booking/orders/BookingFieldEditor";
import { MessageSender } from "../../_components/Dahsboard/booking/orders/MessageSender";
import { ArchiveTable } from "../../_components/Dahsboard/booking/orders/ArchiveTable";
import { EditOrderModal } from "../../_components/Dahsboard/booking/orders/EditOrderModal";
import type { OrderFormInitialValues } from "@/app/_components/Dahsboard/booking/create/OrderForm";
import { exportOrdersToExcel } from "@/lib/exportToExcel";

import { ORDERS as MOCK_ORDERS } from "@/lib/_mockdb";
import type { OrderRow, OrderStatus } from "@/lib/_mockdb";

const DEFAULT_FILTERS: AppliedFilters = {
  status: "",
  customer: "",
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

  //Modal
  const [editingOrder, setEditingOrder] = useState<OrderRow | null>(null);

  // handler for the modal
const handleUpdateOrder = (orderId: string, data: OrderFormInitialValues) => {
  setOrders((prev) =>
    prev.map((o) =>
      o.id === orderId
        ? {
            ...o,
            orderNo:         data.orderNumber    ?? o.orderNo,
            description:     data.description    ?? o.description,
            deliveryDate:    data.deliveryDate   ?? o.deliveryDate,
            timeWindow:      data.timeWindow     ?? o.timeWindow,
            deliveryAddress: data.deliveryAddress ?? o.deliveryAddress,
            name:            data.customerName   ?? o.name,
            phone:           data.phone          ?? o.phone,
            cashierName:     data.cashierName    ?? o.cashierName,
            cashierPhone:    data.cashierPhone   ?? o.cashierPhone,
            subcontractor:   data.subcontractor  ?? o.subcontractor,
            driverInfo:      data.driverInfo     ?? o.driverInfo,
            status:          (data.status as OrderRow["status"]) ?? o.status,
          }
        : o
    )
  );
};

  // example employees
  const employees = [
    { id: "1", name: "Janis Otmans", email: "itworkotman@gmail.com" },
    { id: "2", name: "Ralfs Kolveits", email: "r.kolveits@gmail.com" },
  ];

  /**
   * Options for BookingFieldEditor
   * - These are the dropdown items
   * - Later fetch these from DB
   */
  const statusOptions = useMemo(
    () =>
      [
        { value: "behandles", label: "Behandles" },
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
  const handleSendEmail = async (recipientId: string, type: string) => {
    const employee = employees.find((e) => e.id === recipientId);
    if (!employee) return;

    const selectedOrders = orders.filter((o) => selectedIds.includes(o.id));

    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      recipientName:  employee.name,
      recipientEmail: employee.email,
      type,
      customMessage: type,
      orders: selectedOrders,
    }),
    });
    const data = await res.json();
    if (res.ok) {
        alert("E-post sendt!");
      } else {
        console.error("Email error:", data.error);
        alert("Noe gikk galt. Prøv igjen.");
    }
  };

  const handleSendGSM = async (recipient: string) => {
    console.log("Send GSM:", { recipient, selectedIds });
  };

  const handleCopySelected = () => {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to add a copy of ${selectedIds.length > 1 ? "these orders" : "this order"} to the order list?`
    );

    if (!confirmed) return;

    const copies = orders
      .filter((o) => selectedIds.includes(o.id))
      .map((o) => ({
        ...o,
        //HAVE TO CHANGE LATER!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        id: `${o.id}-copy-`,
      }));

    setOrders((prev) => [...prev, ...copies]);
    setSelectedIds([]);
  };
  
  const handleExportExcel = () => {
    exportOrdersToExcel(orders.filter((r) => selectedIds.includes(r.id)));
  };

  return (
    <div>
      <TopFiltersField
        key={[
          appliedFilters.status,
          appliedFilters.customer,
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
        selectedCount={selectedIds.length}
        onExportExcel={handleExportExcel}
      />

      <div className="flex-1 overflow-auto py-4">
        <ArchiveTable
          filters={appliedFilters}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          orders={orders}
          onRowClick={(row) => setEditingOrder(row)}
        />
        <EditOrderModal
          isOpen={!!editingOrder}
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onUpdate={handleUpdateOrder}
        />
      </div>
    </div>
  );
}