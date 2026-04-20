import type {
  BookingArchiveViewMode,
  OrderRow,
} from "@/app/_components/Dahsboard/booking/archive/types";

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
  getExportValue?: (row: OrderRow) => string;
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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number") return "-";
  return `NOK ${value}`;
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
    getExportValue: (row) => formatCell(row.deliveryDate),
  },
  {
    id: "timeWindow",
    label: "Time window",
    exportHeader: "Time window",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.timeWindow),
  },
  {
    id: "customerLabel",
    label: "Customer",
    exportHeader: "Customer",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.customerLabel),
  },
  {
    id: "orderNumber",
    label: "Order no.",
    exportHeader: "Order no.",
    exportWidth: 14,
    getExportValue: (row) => formatCell(row.orderNumber),
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
    label: "Subcontractor",
    exportHeader: "Subcontractor",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.subcontractor),
  },
  {
    id: "createdAt",
    label: "Created at",
    exportHeader: "Created at",
    exportWidth: 20,
    getExportValue: (row) => formatDateTime(row.createdAt),
  },
  {
    id: "updatedAt",
    label: "Last edited",
    exportHeader: "Last edited",
    exportWidth: 24,
    getExportValue: (row) =>
      row.lastEditedBy
        ? `${formatDateTime(row.updatedAt)} (${row.lastEditedBy})`
        : "-",
  },
  {
    id: "priceExVat",
    label: "Price ex. VAT",
    exportHeader: "Price ex. VAT",
    exportWidth: 16,
    getExportValue: (row) => formatMoney(row.priceExVat),
  },
  {
    id: "priceSubcontractor",
    label: "Subcontractor price",
    exportHeader: "Subcontractor price",
    exportWidth: 18,
    getExportValue: (row) => formatMoney(row.priceSubcontractor),
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
    getExportValue: (row) => formatCell(row.deliveryDate),
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
    label: "Customer",
    exportHeader: "Customer",
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
    label: "Created by",
    exportHeader: "Created by",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.createdBy),
  },
  {
    id: "createdAt",
    label: "Created at",
    exportHeader: "Created at",
    exportWidth: 20,
    getExportValue: (row) => formatDateTime(row.createdAt),
  },
  {
    id: "priceExVat",
    label: "Price ex. VAT",
    exportHeader: "Price ex. VAT",
    exportWidth: 16,
    getExportValue: (row) => formatMoney(row.priceExVat),
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
    getExportValue: (row) => formatCell(row.deliveryDate),
  },
  {
    id: "priceExVat",
    label: "Price ex. VAT",
    exportHeader: "Price ex. VAT",
    exportWidth: 16,
    getExportValue: (row) => formatMoney(row.priceExVat),
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
  const defaultColumnIds = getDefaultVisibleBookingArchiveColumns(viewMode);
  const validColumnIds = new Set(defaultColumnIds);
  const sanitized = new Set(
    columnIds.filter((columnId): columnId is BookingArchiveColumnId =>
      validColumnIds.has(columnId as BookingArchiveColumnId),
    ),
  );

  const shouldForceOrderSummary =
    viewMode === "ADMIN" || viewMode === "SUBCONTRACTOR";

  const hadLegacySummaryColumn = columnIds.some((columnId) =>
    LEGACY_SUMMARY_COLUMN_IDS.has(columnId),
  );

  if (shouldForceOrderSummary && (hadLegacySummaryColumn || !sanitized.has("orderSummary"))) {
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
