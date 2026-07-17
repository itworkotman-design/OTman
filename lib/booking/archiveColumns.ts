import type {
  BookingArchiveViewMode,
  OrderRow,
} from "@/app/_components/Dahsboard/booking/archive/types";
import {
  ADD_TO_ORDER_FEE_CODE,
  EXTRA_WORK_FEE_CODE,
} from "@/lib/booking/pricing/hardcodedFees";
import { DEVIATION_FEE_OPTIONS } from "@/lib/booking/pricing/deviationFees";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/dateDisplay";
import {
  getAdjustedCustomerTotal,
  getAdjustedSubcontractorTotal,
  parseNokAdjustment,
  getPricingSnapshotCustomerTotal,
  getPricingSnapshotSubcontractorTotal,
} from "@/lib/orders/orderTotals";

export type BookingArchiveColumnId =
  | "displayId"
  | "status"
  | "mail"
  | "deliveryDate"
  | "timeWindow"
  | "customerLabel"
  | "orderNumber"
  | "customerName"
  | "phone"
  | "pickupAddress"
  | "extraPickupAddress"
  | "deliveryAddress"
  | "orderSummary"
  | "description"
  | "cashierName"
  | "cashierPhone"
  | "customerComments"
  | "driverInfo"
  | "subcontractor"
  | "createdAt"
  | "updatedAt"
  | "dnbDiscount"
  | "priceExVat"
  | "priceSubcontractor"
  | "statusNotes"
  | "driver"
  | "createdBy";

export type BookingArchiveColumn = {
  id: BookingArchiveColumnId;
  label: string;
  exportHeader?: string;
  exportWidth?: number;
  getExportValue?: (row: OrderRow) => string | number | null;
};

const LEGACY_SUMMARY_COLUMN_IDS = new Set([
  "productsSummary",
  "deliveryTypeSummary",
  "servicesSummary",
]);

function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return String(value);
  if (!value.trim()) return "-";
  return value;
}

function formatMoney(value: number | null | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function formatDnbDiscount(value: number | null): string {
  return typeof value === "number" && value > 0 ? `20% - NOK ${value}` : "-";
}

const PROTECTED_CANCELLED_TOTAL_CODES = new Set([
  EXTRA_WORK_FEE_CODE,
  ADD_TO_ORDER_FEE_CODE,
  ...DEVIATION_FEE_OPTIONS.map((option) => option.code),
]);

function getProtectedCancelledCustomerTotal(
  row: Pick<OrderRow, "calculatorItems">,
): number {
  const total = row.calculatorItems.reduce((sum, item) => {
    if (!PROTECTED_CANCELLED_TOTAL_CODES.has(item.optionCode)) {
      return sum;
    }

    const lineCents = item.customerPriceCents ?? 0;
    const quantity = item.quantity > 0 ? item.quantity : 1;
    return sum + (lineCents * quantity) / 100;
  }, 0);

  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function getProtectedCancelledSubcontractorTotal(
  row: Pick<OrderRow, "calculatorItems">,
): number {
  const total = row.calculatorItems.reduce((sum, item) => {
    if (!PROTECTED_CANCELLED_TOTAL_CODES.has(item.optionCode)) {
      return sum;
    }

    const lineCents = item.subcontractorPriceCents ?? 0;
    const quantity = item.quantity > 0 ? item.quantity : 1;
    return sum + (lineCents * quantity) / 100;
  }, 0);

  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function getEffectiveArchiveCustomerTotal(row: Pick<OrderRow, "status" | "priceExVat" | "pricingSnapshot" | "rabatt" | "leggTil" | "calculatorItems">): number {
  const snapshotTotal = getPricingSnapshotCustomerTotal(row.pricingSnapshot);
  if (snapshotTotal !== null) {
    return snapshotTotal;
  }

  if (row.status === "cancelled" && !row.rabatt.trim()) {
    return getProtectedCancelledCustomerTotal(row);
  }

  const roundedTotal = getAdjustedCustomerTotal({
    subtotal: row.priceExVat,
    rabatt: row.rabatt,
    leggTil: row.leggTil,
  });

  if (row.status !== "cancelled") {
    return roundedTotal;
  }

  return Math.max(roundedTotal, getProtectedCancelledCustomerTotal(row));
}

export function getDnbDiscountArchiveAmount(row: Pick<OrderRow, "dnbDiscount" | "priceExVat" | "pricingSnapshot" | "rabatt" | "leggTil">): number | null {
  if (!row.dnbDiscount) {
    return null;
  }

  const snapshot = row.pricingSnapshot && typeof row.pricingSnapshot === "object" && !Array.isArray(row.pricingSnapshot)
    ? row.pricingSnapshot as { customer?: { totalExVat?: unknown } }
    : null;
  const snapshotTotal = snapshot?.customer?.totalExVat;

  if (typeof snapshotTotal === "number" && Number.isFinite(snapshotTotal) && snapshotTotal > 0) {
    return Math.round(snapshotTotal / 4);
  }

  const adjustedTotal = getAdjustedCustomerTotal({
    subtotal: row.priceExVat,
    rabatt: row.rabatt,
    leggTil: row.leggTil,
  });
  return adjustedTotal > 0 ? Math.round(adjustedTotal / 4) : null;
}

export function getEffectiveArchiveSubcontractorTotal(
  row: Pick<OrderRow, "status" | "priceSubcontractor" | "pricingSnapshot" | "subcontractorMinus" | "subcontractorPlus" | "calculatorItems">,
): number {
  const snapshotTotal = getPricingSnapshotSubcontractorTotal(row.pricingSnapshot);
  if (snapshotTotal !== null) {
    return snapshotTotal;
  }

  if (row.status === "cancelled" && !row.subcontractorMinus.trim()) {
    return getProtectedCancelledSubcontractorTotal(row);
  }

  const roundedTotal = getAdjustedSubcontractorTotal({
    subtotal: row.priceSubcontractor,
    subcontractorMinus: row.subcontractorMinus,
    subcontractorPlus: row.subcontractorPlus,
  });

  if (row.status !== "cancelled") {
    return roundedTotal;
  }

  return Math.max(roundedTotal, getProtectedCancelledSubcontractorTotal(row));
}

const adminColumns: BookingArchiveColumn[] = [
  {
    id: "displayId",
    label: "ID",
    exportHeader: "ID",
    exportWidth: 12,
    getExportValue: (row) => formatCell(row.displayId),
  },
  {
    id: "status",
    label: "Status",
    exportHeader: "Status",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.status),
  },
  {
    id: "mail",
    label: "Alerts",
  },
  {
    id: "deliveryDate",
    label: "Delivery date",
    exportHeader: "Delivery date",
    exportWidth: 16,
    getExportValue: (row) => formatDisplayDate(row.deliveryDate),
  },
  {
    id: "timeWindow",
    label: "Time window",
    exportHeader: "Time window",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.timeWindow),
  },
  {
    id: "createdBy",
    label: "Store",
    exportHeader: "Store",
    exportWidth: 20,
    getExportValue: (row) => formatCell(row.createdBy),
  },
  {
    id: "customerLabel",
    label: "Customer name",
    exportHeader: "Customer name",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.customerName),
  },
  {
    id: "orderNumber",
    label: "Order no.",
    exportHeader: "Order no.",
    exportWidth: 14,
    getExportValue: (row) => formatCell(row.orderNumber),
  },
  {
    id: "phone",
    label: "Phone",
    exportHeader: "Phone",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.phone),
  },
  {
    id: "pickupAddress",
    label: "Pickup address",
    exportHeader: "Pickup address",
    exportWidth: 28,
    getExportValue: (row) => formatCell(row.pickupAddress),
  },
  {
    id: "extraPickupAddress",
    label: "Extra pickup",
    exportHeader: "Extra pickup",
    exportWidth: 28,
    getExportValue: (row) =>
      row.extraPickupAddress.length > 0 ? row.extraPickupAddress.join(", ") : "-",
  },
  {
    id: "deliveryAddress",
    label: "Delivery address",
    exportHeader: "Delivery address",
    exportWidth: 28,
    getExportValue: (row) => formatCell(row.deliveryAddress),
  },
  {
    id: "orderSummary",
    label: "Products",
    exportHeader: "Products",
    exportWidth: 40,
    getExportValue: (row) => formatCell(row.orderSummaryText),
  },
  {
    id: "description",
    label: "Description",
    exportHeader: "Description",
    exportWidth: 22,
    getExportValue: (row) => formatCell(row.description),
  },
  {
    id: "cashierName",
    label: "Cashier name",
    exportHeader: "Cashier name",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.cashierName),
  },
  {
    id: "cashierPhone",
    label: "Cashier phone",
    exportHeader: "Cashier phone",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.cashierPhone),
  },
  {
    id: "customerComments",
    label: "Customer notes",
    exportHeader: "Customer notes",
    exportWidth: 26,
    getExportValue: (row) => formatCell(row.customerComments),
  },
  {
    id: "driverInfo",
    label: "Driver info",
    exportHeader: "Driver info",
    exportWidth: 20,
    getExportValue: (row) => formatCell(row.driverInfo),
  },
  {
    id: "subcontractor",
    label: "Partner",
    exportHeader: "Partner",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.subcontractor),
  },
  {
    id: "createdAt",
    label: "Created at",
    exportHeader: "Created at",
    exportWidth: 20,
    getExportValue: (row) => formatDisplayDateTime(row.createdAt),
  },
  {
    id: "updatedAt",
    label: "Last edited",
    exportHeader: "Last edited",
    exportWidth: 24,
    getExportValue: (row) =>
      row.lastEditedBy
        ? `${formatDisplayDateTime(row.updatedAt)} (${row.lastEditedBy})`
        : "-",
  },
  {
    id: "dnbDiscount",
    label: "DNB discount",
    exportHeader: "DNB discount",
    exportWidth: 18,
    getExportValue: (row) => formatDnbDiscount(getDnbDiscountArchiveAmount(row)),
  },
  {
    id: "priceExVat",
    label: "Price ex. VAT",
    exportHeader: "Price ex. VAT",
    exportWidth: 16,
    getExportValue: (row) => formatMoney(getEffectiveArchiveCustomerTotal(row)),
  },
  {
    id: "priceSubcontractor",
    label: "Partner price",
    exportHeader: "Partner price",
    exportWidth: 18,
    getExportValue: (row) => formatMoney(getEffectiveArchiveSubcontractorTotal(row)),
  },
];

const subcontractorColumns: BookingArchiveColumn[] = [
  {
    id: "displayId",
    label: "ID",
    exportHeader: "ID",
    exportWidth: 12,
    getExportValue: (row) => formatCell(row.displayId),
  },
  {
    id: "status",
    label: "Status",
    exportHeader: "Status",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.status),
  },
  {
    id: "deliveryDate",
    label: "Delivery date",
    exportHeader: "Delivery date",
    exportWidth: 16,
    getExportValue: (row) => formatDisplayDate(row.deliveryDate),
  },
  {
    id: "timeWindow",
    label: "Time window",
    exportHeader: "Time window",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.timeWindow),
  },
  {
    id: "customerName",
    label: "Customer name",
    exportHeader: "Customer name",
    exportWidth: 20,
    getExportValue: (row) => formatCell(row.customerName),
  },
  {
    id: "orderNumber",
    label: "Order no.",
    exportHeader: "Order no.",
    exportWidth: 14,
    getExportValue: (row) => formatCell(row.orderNumber),
  },
  {
    id: "pickupAddress",
    label: "Pickup address",
    exportHeader: "Pickup address",
    exportWidth: 28,
    getExportValue: (row) => formatCell(row.pickupAddress),
  },
  {
    id: "extraPickupAddress",
    label: "Extra pickup",
    exportHeader: "Extra pickup",
    exportWidth: 28,
    getExportValue: (row) =>
      row.extraPickupAddress.length > 0 ? row.extraPickupAddress.join(", ") : "-",
  },
  {
    id: "deliveryAddress",
    label: "Delivery address",
    exportHeader: "Delivery address",
    exportWidth: 28,
    getExportValue: (row) => formatCell(row.deliveryAddress),
  },
  {
    id: "orderSummary",
    label: "Products",
    exportHeader: "Products",
    exportWidth: 40,
    getExportValue: (row) => formatCell(row.orderSummaryText),
  },
  {
    id: "description",
    label: "Description",
    exportHeader: "Description",
    exportWidth: 22,
    getExportValue: (row) => formatCell(row.description),
  },
  {
    id: "cashierName",
    label: "Cashier name",
    exportHeader: "Cashier name",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.cashierName),
  },
  {
    id: "cashierPhone",
    label: "Cashier phone",
    exportHeader: "Cashier phone",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.cashierPhone),
  },
  {
    id: "customerComments",
    label: "Customer notes",
    exportHeader: "Customer notes",
    exportWidth: 26,
    getExportValue: (row) => formatCell(row.customerComments),
  },
  {
    id: "driver",
    label: "Driver",
    exportHeader: "Driver",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.driver),
  },
  {
    id: "createdBy",
    label: "Store",
    exportHeader: "Store",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.createdBy),
  },
  {
    id: "createdAt",
    label: "Created at",
    exportHeader: "Created at",
    exportWidth: 20,
    getExportValue: (row) => formatDisplayDateTime(row.createdAt),
  },
  {
    id: "priceSubcontractor",
    label: "Partner price",
    exportHeader: "Partner price",
    exportWidth: 18,
    getExportValue: (row) => formatMoney(getEffectiveArchiveSubcontractorTotal(row)),
  },
];

const orderCreatorColumns: BookingArchiveColumn[] = [
  {
    id: "displayId",
    label: "ID",
    exportHeader: "ID",
    exportWidth: 12,
    getExportValue: (row) => formatCell(row.displayId),
  },
  {
    id: "status",
    label: "Status",
    exportHeader: "Status",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.status),
  },
  {
    id: "mail",
    label: "Alerts",
  },
  {
    id: "statusNotes",
    label: "Status notes",
    exportHeader: "Status notes",
    exportWidth: 24,
    getExportValue: (row) => formatCell(row.statusNotes),
  },
  {
    id: "orderNumber",
    label: "Order no.",
    exportHeader: "Order no.",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.orderNumber),
  },
  {
    id: "description",
    label: "Description",
    exportHeader: "Description",
    exportWidth: 22,
    getExportValue: (row) => formatCell(row.description),
  },
  {
    id: "customerName",
    label: "Customer name",
    exportHeader: "Customer name",
    exportWidth: 20,
    getExportValue: (row) => formatCell(row.customerName),
  },
  {
    id: "phone",
    label: "Phone",
    exportHeader: "Phone",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.phone),
  },
  {
    id: "deliveryDate",
    label: "Delivery date",
    exportHeader: "Delivery date",
    exportWidth: 16,
    getExportValue: (row) => formatDisplayDate(row.deliveryDate),
  },
  {
    id: "priceExVat",
    label: "Price ex. VAT",
    exportHeader: "Price ex. VAT",
    exportWidth: 16,
    getExportValue: (row) => formatMoney(getEffectiveArchiveCustomerTotal(row)),
  },
];

export const BOOKING_ARCHIVE_COLUMNS: Record<
  BookingArchiveViewMode,
  BookingArchiveColumn[]
> = {
  ADMIN: adminColumns,
  SUBCONTRACTOR: subcontractorColumns,
  ORDER_CREATOR: orderCreatorColumns,
};

export function getBookingArchiveColumns(
  viewMode: BookingArchiveViewMode,
): BookingArchiveColumn[] {
  return BOOKING_ARCHIVE_COLUMNS[viewMode];
}

export function getDefaultVisibleBookingArchiveColumns(
  viewMode: BookingArchiveViewMode,
): BookingArchiveColumnId[] {
  return getBookingArchiveColumns(viewMode).map((column) => column.id);
}

export function sanitizeVisibleBookingArchiveColumns(
  viewMode: BookingArchiveViewMode,
  columnIds: string[],
): BookingArchiveColumnId[] {
  const normalizedColumnIds = columnIds.map((columnId) =>
    viewMode === "ADMIN" && columnId === "customerName" ? "createdBy" : columnId,
  );
  const defaultColumnIds = getDefaultVisibleBookingArchiveColumns(viewMode);
  const validColumnIds = new Set(defaultColumnIds);
  const sanitized = new Set(
    normalizedColumnIds.filter((columnId): columnId is BookingArchiveColumnId =>
      validColumnIds.has(columnId as BookingArchiveColumnId),
    ),
  );

  const shouldForceOrderSummary =
    viewMode === "ADMIN" || viewMode === "SUBCONTRACTOR";

  const hadLegacySummaryColumn = normalizedColumnIds.some((columnId) =>
    LEGACY_SUMMARY_COLUMN_IDS.has(columnId),
  );

  if (shouldForceOrderSummary && hadLegacySummaryColumn) {
    sanitized.add("orderSummary");
  }

  if (
    viewMode === "ADMIN" &&
    sanitized.has("priceSubcontractor") &&
    !sanitized.has("priceExVat")
  ) {
    sanitized.add("priceExVat");
  }

  if (sanitized.size > 0) {
    return defaultColumnIds.filter((columnId) => sanitized.has(columnId));
  }

  return defaultColumnIds;
}

export function getBookingArchiveExportColumns(
  viewMode: BookingArchiveViewMode,
  visibleColumnIds: string[],
): BookingArchiveColumn[] {
  const visibleSet = new Set(
    sanitizeVisibleBookingArchiveColumns(viewMode, visibleColumnIds),
  );

  return getBookingArchiveColumns(viewMode).filter(
    (column) => !!column.exportHeader && visibleSet.has(column.id),
  );
}

export function getBookingArchiveVisibilityStorageKey(
  viewMode: BookingArchiveViewMode,
): string {
  return `booking-archive-visible-columns:${viewMode}`;
}
