// path: lib/booking/exportOrdersToExcel.ts
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type {
  BookingArchiveViewMode,
  OrderRow,
} from "@/app/_components/Dahsboard/booking/archive/types";

type ExcelCellValue = string | number | boolean | null;
type ExcelRow = Record<string, ExcelCellValue>;

function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return String(value);
  if (!value.trim()) return "-";
  return value;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMoney(value?: number | null): string {
  if (typeof value !== "number") return "-";
  return `NOK ${value}`;
}

function getRowsForExport(
  selected: OrderRow[],
  viewMode: BookingArchiveViewMode,
): ExcelRow[] {
  if (viewMode === "ADMIN") {
    return selected.map((o) => ({
      ID: formatCell(o.displayId),
      Status: formatCell(o.status),
      Leveringsdato: formatCell(o.deliveryDate),
      Tidsvindu: formatCell(o.timeWindow),
      Customer: formatCell(o.customerLabel),
      "Best.nr": formatCell(o.orderNumber),
      Navn: formatCell(o.customerName),
      Telefon: formatCell(o.phone),
      "Pickup Adresse": formatCell(o.pickupAddress),
      "Extra pickup":
        o.extraPickupAddress.length > 0 ? o.extraPickupAddress.join(", ") : "-",
      Leveringsadresse: formatCell(o.deliveryAddress),
      Produkter: formatCell(o.productsSummary),
      Leveringstype: formatCell(o.deliveryTypeSummary),
      "Montering/retur": formatCell(o.servicesSummary),
      Beskrivelse: formatCell(o.description),
      "Kasserers navn": formatCell(o.cashierName),
      "Kasserers telefon": formatCell(o.cashierPhone),
      Kundenotater: formatCell(o.customerComments),
      "Driver info": formatCell(o.driverInfo),
      Subcontractor: formatCell(o.subcontractor),
      Bestillingsdato: formatDateTime(o.createdAt),
      "Sist redigert": o.lastEditedBy
        ? `${formatDateTime(o.updatedAt)} (${o.lastEditedBy})`
        : "-",
      "Pris uten MVA": formatMoney(o.priceExVat),
      "Pris Subcontractor": formatMoney(o.priceSubcontractor),
    }));
  }

  if (viewMode === "SUBCONTRACTOR") {
    return selected.map((o) => ({
      Status: formatCell(o.status),
      Leveringsdato: formatCell(o.deliveryDate),
      Tidsvindu: formatCell(o.timeWindow),
      Customer: formatCell(o.customerName),
      "Best.nr": formatCell(o.orderNumber),
      "Pickup Adresse": formatCell(o.pickupAddress),
      "Extra pickup":
        o.extraPickupAddress.length > 0 ? o.extraPickupAddress.join(", ") : "-",
      Leveringsadresse: formatCell(o.deliveryAddress),
      Produkter: formatCell(o.productsSummary),
      Leveringstype: formatCell(o.deliveryTypeSummary),
      "Montering/retur": formatCell(o.servicesSummary),
      Beskrivelse: formatCell(o.description),
      "Kasserers navn": formatCell(o.cashierName),
      "Kasserers telefon": formatCell(o.cashierPhone),
      Kundenotater: formatCell(o.customerComments),
      Driver: formatCell(o.driver),
      "Opprettet av": formatCell(o.createdBy),
      Bestillingsdato: formatDateTime(o.createdAt),
      TotalPris: formatMoney(o.priceExVat),
    }));
  }

  return selected.map((o) => ({
    Status: formatCell(o.status),
    "Status notater": formatCell(o.statusNotes),
    "Bestillings nr": formatCell(o.orderNumber),
    "Kundens navn": formatCell(o.customerName),
    "Kundens telefon": formatCell(o.phone),
    Leveringsdato: formatCell(o.deliveryDate),
    "Pris uten MVA": formatMoney(o.priceExVat),
  }));
}

function getColumnWidths(viewMode: BookingArchiveViewMode): number[] {
  if (viewMode === "ADMIN") {
    return [
      12, 16, 16, 16, 18, 14, 20, 16, 28, 28, 28, 34, 26, 32, 22, 18, 18, 26,
      20, 18, 20, 24, 16, 18,
    ];
  }

  if (viewMode === "SUBCONTRACTOR") {
    return [
      16, 16, 16, 20, 14, 28, 28, 28, 34, 26, 32, 22, 18, 18, 26, 18, 18, 20,
      16,
    ];
  }

  return [16, 24, 18, 20, 18, 16, 16];
}

export async function exportOrdersToExcel({
  rows,
  selectedIds,
  viewMode,
}: {
  rows: OrderRow[];
  selectedIds: string[];
  viewMode: BookingArchiveViewMode;
}) {
  const selected = rows.filter((row) => selectedIds.includes(row.id));
  if (selected.length === 0) return;

  const data = getRowsForExport(selected, viewMode);
  if (data.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Orders", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = Object.keys(data[0]);
  worksheet.columns = headers.map((header, index) => ({
    header,
    key: header,
    width: getColumnWidths(viewMode)[index] ?? 20,
  }));

  data.forEach((row) => {
    worksheet.addRow(row);
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 36;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 12,
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // archive-like blue
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.height = 24;

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "orders.xlsx",
  );
}
