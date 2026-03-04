"use client";

import { useMemo, useState } from "react";

import TopFiltersField, {
  type AppliedFilters,
} from "../../../_components/Dahsboard/booking/orders/TopFiltersField";
import { ArchiveTable } from "../../../_components/Dahsboard/booking/orders/ArchiveTable";
import { EditOrderModal } from "../../../_components/Dahsboard/booking/orders/EditOrderModal";
import type { OrderFormInitialValues } from "@/app/_components/Dahsboard/booking/create/OrderForm";

import { ORDERS as MOCK_ORDERS } from "@/lib/_mockdb";
import type { OrderRow } from "@/lib/_mockdb";

const DEFAULT_FILTERS: AppliedFilters = {
  status: "",
  customer: "",
  subcontractor: "Sub A",
  fromDate: "",
  toDate: "",
  search: "",
  rowsPerPage: 10,
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

  const handleApplyFilters = (next: AppliedFilters) => {
    setAppliedFilters(next);
    setSelectedIds([]);
  };

  const handleResetFilters = () => {
    setAppliedFilters(DEFAULT_FILTERS);
    setSelectedIds([]);
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