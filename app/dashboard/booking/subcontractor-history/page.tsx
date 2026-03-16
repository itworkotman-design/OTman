"use client";

import { useState } from "react";

import TopFiltersField, {
  type AppliedFilters,
} from "../../../_components/Dahsboard/booking/orders/TopFiltersField";
import { ArchiveTable } from "../../../_components/Dahsboard/booking/orders/ArchiveTable";
import { SubcontractorOrderModal } from "../../../_components/Dahsboard/booking/orders/SubcontractorOrderModal";
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

const SUBCONTRACTOR_VISIBLE_COLUMNS = [
  "status",
  "deliveryDate",
  "timeWindow",
  "customer",
  "orderNo",
  "pickupAddress",
  "extraPickup",
  "deliveryAddress",
  "returnAddress",
  "products",
  "deliveryType",
  "assemblyReturn",
  "description",
  "cashierName",
  "cashierPhone",
  "customerNotes",
  "driverInfo",
  "orderDate",
  "totalPriceExVat",
] as const;

export default function AllOrders() {
  const userView = "subcontractor";
  const loggedInSubcontractor = "Sub A";
  const [orders, setOrders] = useState<OrderRow[]>(MOCK_ORDERS);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  const safeFilters =
    userView === "subcontractor"
      ? {
          ...appliedFilters,
          subcontractor: loggedInSubcontractor,
        }
      : appliedFilters;

  const handleUpdateOrder = (orderId: string, data: OrderFormInitialValues) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              orderNo: data.orderNumber ?? o.orderNo,
              description: data.description ?? o.description,
              deliveryDate: data.deliveryDate ?? o.deliveryDate,
              timeWindow: data.timeWindow ?? o.timeWindow,
              deliveryAddress: data.deliveryAddress ?? o.deliveryAddress,
              name: data.customerName ?? o.name,
              phone: data.phone ?? o.phone,
              cashierName: data.cashierName ?? o.cashierName,
              cashierPhone: data.cashierPhone ?? o.cashierPhone,
              subcontractor: data.subcontractor ?? o.subcontractor,
              driverInfo: data.driverInfo ?? o.driverInfo,
              status: (data.status as OrderRow["status"]) ?? o.status,
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
        initialApplied={safeFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        userView={userView}
        lockedSubcontractor={loggedInSubcontractor}
      />

      <div className="flex-1 overflow-auto py-4">
        <ArchiveTable
          filters={safeFilters}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          orders={orders}
          onRowClick={(row) => setSelectedOrder(row)}
          visibleColumns={SUBCONTRACTOR_VISIBLE_COLUMNS}
          userView="subcontractor"
        />

        <SubcontractorOrderModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      </div>
    </div>
  );
}