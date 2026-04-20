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
  | "productsSummary"
  | "deliveryTypeSummary"
  | "servicesSummary"
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
    label: "Leveringsdato",
    exportHeader: "Leveringsdato",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.deliveryDate),
  },
  {
    id: "timeWindow",
    label: "Tidsvindu",
    exportHeader: "Tidsvindu",
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
    label: "Best.nr",
    exportHeader: "Best.nr",
    exportWidth: 14,
    getExportValue: (row) => formatCell(row.orderNumber),
  },
  {
    id: "customerName",
    label: "Navn",
    exportHeader: "Navn",
    exportWidth: 20,
    getExportValue: (row) => formatCell(row.customerName),
  },
  {
    id: "phone",
    label: "Telefon",
    exportHeader: "Telefon",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.phone),
  },
  {
    id: "pickupAddress",
    label: "Pickup Adresse",
    exportHeader: "Pickup Adresse",
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
    label: "Leveringsadresse",
    exportHeader: "Leveringsadresse",
    exportWidth: 28,
    getExportValue: (row) => formatCell(row.deliveryAddress),
  },
  {
    id: "productsSummary",
    label: "Produkter",
    exportHeader: "Produkter",
    exportWidth: 34,
    getExportValue: (row) => formatCell(row.productsSummary),
  },
  {
    id: "deliveryTypeSummary",
    label: "Leveringstype",
    exportHeader: "Leveringstype",
    exportWidth: 26,
    getExportValue: (row) => formatCell(row.deliveryTypeSummary),
  },
  {
    id: "servicesSummary",
    label: "Montering/retur",
    exportHeader: "Montering/retur",
    exportWidth: 32,
    getExportValue: (row) => formatCell(row.servicesSummary),
  },
  {
    id: "description",
    label: "Beskrivelse",
    exportHeader: "Beskrivelse",
    exportWidth: 22,
    getExportValue: (row) => formatCell(row.description),
  },
  {
    id: "cashierName",
    label: "Kasserers navn",
    exportHeader: "Kasserers navn",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.cashierName),
  },
  {
    id: "cashierPhone",
    label: "Kasserers telefon",
    exportHeader: "Kasserers telefon",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.cashierPhone),
  },
  {
    id: "customerComments",
    label: "Kundenotater",
    exportHeader: "Kundenotater",
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
    label: "Bestillingsdato",
    exportHeader: "Bestillingsdato",
    exportWidth: 20,
    getExportValue: (row) => formatDateTime(row.createdAt),
  },
  {
    id: "updatedAt",
    label: "Sist redigert",
    exportHeader: "Sist redigert",
    exportWidth: 24,
    getExportValue: (row) =>
      row.lastEditedBy
        ? `${formatDateTime(row.updatedAt)} (${row.lastEditedBy})`
        : "-",
  },
  {
    id: "priceExVat",
    label: "Pris uten MVA",
    exportHeader: "Pris uten MVA",
    exportWidth: 16,
    getExportValue: (row) => formatMoney(row.priceExVat),
  },
  {
    id: "priceSubcontractor",
    label: "Pris Subcontractor",
    exportHeader: "Pris Subcontractor",
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
    label: "Leveringsdato",
    exportHeader: "Leveringsdato",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.deliveryDate),
  },
  {
    id: "timeWindow",
    label: "Tidsvindu",
    exportHeader: "Tidsvindu",
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
    label: "Best.nr",
    exportHeader: "Best.nr",
    exportWidth: 14,
    getExportValue: (row) => formatCell(row.orderNumber),
  },
  {
    id: "pickupAddress",
    label: "Pickup Adresse",
    exportHeader: "Pickup Adresse",
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
    label: "Leveringsadresse",
    exportHeader: "Leveringsadresse",
    exportWidth: 28,
    getExportValue: (row) => formatCell(row.deliveryAddress),
  },
  {
    id: "productsSummary",
    label: "Produkter",
    exportHeader: "Produkter",
    exportWidth: 34,
    getExportValue: (row) => formatCell(row.productsSummary),
  },
  {
    id: "deliveryTypeSummary",
    label: "Leveringstype",
    exportHeader: "Leveringstype",
    exportWidth: 26,
    getExportValue: (row) => formatCell(row.deliveryTypeSummary),
  },
  {
    id: "servicesSummary",
    label: "Montering/retur",
    exportHeader: "Montering/retur",
    exportWidth: 32,
    getExportValue: (row) => formatCell(row.servicesSummary),
  },
  {
    id: "description",
    label: "Beskrivelse",
    exportHeader: "Beskrivelse",
    exportWidth: 22,
    getExportValue: (row) => formatCell(row.description),
  },
  {
    id: "cashierName",
    label: "Kasserers navn",
    exportHeader: "Kasserers navn",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.cashierName),
  },
  {
    id: "cashierPhone",
    label: "Kasserers telefon",
    exportHeader: "Kasserers telefon",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.cashierPhone),
  },
  {
    id: "customerComments",
    label: "Kundenotater",
    exportHeader: "Kundenotater",
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
    label: "Opprettet av",
    exportHeader: "Opprettet av",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.createdBy),
  },
  {
    id: "createdAt",
    label: "Bestillingsdato",
    exportHeader: "Bestillingsdato",
    exportWidth: 20,
    getExportValue: (row) => formatDateTime(row.createdAt),
  },
  {
    id: "priceExVat",
    label: "TotalPris",
    exportHeader: "TotalPris",
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
    label: "Status notater",
    exportHeader: "Status notater",
    exportWidth: 24,
    getExportValue: (row) => formatCell(row.statusNotes),
  },
  {
    id: "orderNumber",
    label: "Bestillings nr",
    exportHeader: "Bestillings nr",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.orderNumber),
  },
  {
    id: "customerName",
    label: "Kundens navn",
    exportHeader: "Kundens navn",
    exportWidth: 20,
    getExportValue: (row) => formatCell(row.customerName),
  },
  {
    id: "phone",
    label: "Kundens telefon",
    exportHeader: "Kundens telefon",
    exportWidth: 18,
    getExportValue: (row) => formatCell(row.phone),
  },
  {
    id: "deliveryDate",
    label: "Leveringsdato",
    exportHeader: "Leveringsdato",
    exportWidth: 16,
    getExportValue: (row) => formatCell(row.deliveryDate),
  },
  {
    id: "priceExVat",
    label: "Pris uten MVA",
    exportHeader: "Pris uten MVA",
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
  const validColumnIds = new Set(getDefaultVisibleBookingArchiveColumns(viewMode));
  const sanitized = columnIds.filter((columnId): columnId is BookingArchiveColumnId =>
    validColumnIds.has(columnId as BookingArchiveColumnId),
  );

  if (sanitized.length > 0) {
    return getDefaultVisibleBookingArchiveColumns(viewMode).filter((columnId) =>
      sanitized.includes(columnId),
    );
  }

  return getDefaultVisibleBookingArchiveColumns(viewMode);
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
