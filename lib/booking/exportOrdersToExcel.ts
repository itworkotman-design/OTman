// path: lib/booking/exportOrdersToExcel.ts
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type {
  BookingArchiveViewMode,
  OrderRow,
} from "@/app/_components/Dahsboard/booking/archive/types";
import {
  getBookingArchiveExportColumns,
  type BookingArchiveColumnId,
} from "@/lib/booking/archiveColumns";

type ExcelCellValue = string | number | boolean | null;
type ExcelRow = Record<string, ExcelCellValue>;

const RIGHT_ALIGNED_COLUMN_IDS = new Set<BookingArchiveColumnId>([
  "priceExVat",
  "priceSubcontractor",
]);

function isRightAlignedColumn(columnId: BookingArchiveColumnId) {
  return RIGHT_ALIGNED_COLUMN_IDS.has(columnId);
}

async function writeOrdersWorkbook({
  rows,
  viewMode,
  visibleColumnIds,
  filename,
}: {
  rows: OrderRow[];
  viewMode: BookingArchiveViewMode;
  visibleColumnIds: BookingArchiveColumnId[];
  filename: string;
}) {
  if (rows.length === 0) return;

  const exportColumns = getBookingArchiveExportColumns(viewMode, visibleColumnIds);
  if (exportColumns.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Orders", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = exportColumns.map((column) => ({
    header: column.exportHeader,
    key: column.id,
    width: column.exportWidth ?? 20,
  }));

  rows.forEach((order) => {
    const row: ExcelRow = {};

    exportColumns.forEach((column) => {
      if (!column.exportHeader || !column.getExportValue) return;
      row[column.id] = column.getExportValue(order);
    });

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

    row.eachCell((cell, columnNumber) => {
      const column = exportColumns[columnNumber - 1];
      const rightAligned = column ? isRightAlignedColumn(column.id) : false;

      cell.alignment = {
        vertical: "top",
        horizontal: rightAligned ? "right" : "left",
        wrapText: true,
      };
      if (rightAligned) {
        cell.numFmt = "#,##0";
      }
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
    to: { row: 1, column: exportColumns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

export async function exportOrdersToExcel({
  rows,
  selectedIds,
  viewMode,
  visibleColumnIds,
}: {
  rows: OrderRow[];
  selectedIds: string[];
  viewMode: BookingArchiveViewMode;
  visibleColumnIds: BookingArchiveColumnId[];
}) {
  const selectedIdSet = new Set(selectedIds);
  const selected = rows.filter((row) => selectedIdSet.has(row.id));

  await writeOrdersWorkbook({
    rows: selected,
    viewMode,
    visibleColumnIds,
    filename: "orders.xlsx",
  });
}

export async function exportVisibleOrdersToExcel({
  rows,
  viewMode,
  visibleColumnIds,
}: {
  rows: OrderRow[];
  viewMode: BookingArchiveViewMode;
  visibleColumnIds: BookingArchiveColumnId[];
}) {
  await writeOrdersWorkbook({
    rows,
    viewMode,
    visibleColumnIds,
    filename: "ordre-tabell.xlsx",
  });
}
