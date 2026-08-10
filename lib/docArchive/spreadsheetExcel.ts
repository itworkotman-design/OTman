import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MAX_COLUMNS, MAX_ROWS, type SheetCell, type SpreadsheetData } from "@/lib/docArchive/spreadsheetShared";

// Client-side .xlsx export/import for the Spreadsheet content section — same
// exceljs + file-saver, no-server-round-trip convention already used by
// lib/booking/exportOrdersToExcel.ts.

function hexToArgb(hex: string): string {
  return `FF${hex.slice(1).toUpperCase()}`;
}

function argbToHex(argb: string | undefined): string | undefined {
  if (!argb || argb.length !== 8) return undefined;
  return `#${argb.slice(2).toLowerCase()}`;
}

export async function exportSpreadsheetToExcel(data: SpreadsheetData, filename: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1", { views: [{ state: "frozen", ySplit: 1 }] });

  worksheet.addRow(data.columnNames);
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  data.cells.forEach((row) => {
    const excelRow = worksheet.addRow(row.map((cell) => cell.value));
    row.forEach((cell, columnIndex) => {
      if (!cell.bg) return;
      excelRow.getCell(columnIndex + 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hexToArgb(cell.bg) },
      };
    });
  });

  worksheet.columns.forEach((column) => {
    column.width = 16;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}

// Formulas/rich text/dates aren't part of this section's scope (plain
// text/number cells only) — any non-primitive cell value is flattened to a
// display string rather than preserved structurally.
function cellValueToDisplayString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return cellValueToDisplayString(value.result);
    if ("richText" in value) return value.richText.map((run) => run.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    return "";
  }
  return String(value);
}

export async function importSpreadsheetFromExcelFile(file: File): Promise<SpreadsheetData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { columnNames: [], cells: [] };

  const columnCount = Math.min(worksheet.columnCount, MAX_COLUMNS);
  const columnNames = Array.from({ length: columnCount }, (_, i) =>
    cellValueToDisplayString(worksheet.getRow(1).getCell(i + 1).value) || `Column ${i + 1}`,
  );

  const rowCount = Math.min(Math.max(worksheet.rowCount - 1, 0), MAX_ROWS);
  const cells: SheetCell[][] = Array.from({ length: rowCount }, (_, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 2);
    return Array.from({ length: columnCount }, (_, columnIndex): SheetCell => {
      const excelCell = excelRow.getCell(columnIndex + 1);
      const value = cellValueToDisplayString(excelCell.value);
      const fill = excelCell.fill;
      const bg =
        fill?.type === "pattern" && fill.pattern === "solid" && "fgColor" in fill
          ? argbToHex(fill.fgColor?.argb)
          : undefined;
      return bg ? { value, bg } : { value };
    });
  });

  return { columnNames, cells };
}
