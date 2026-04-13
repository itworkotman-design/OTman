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
  const selected = rows.filter((row) => selectedIds.includes(row.id));
  if (selected.length === 0) return;

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

  selected.forEach((order) => {
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
    to: { row: 1, column: exportColumns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "orders.xlsx",
  );
}
