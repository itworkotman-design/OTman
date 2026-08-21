import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  MAX_COLUMN_WIDTH,
  MAX_COLUMNS,
  MAX_ROW_HEIGHT,
  MAX_ROWS,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  type SheetCell,
  type SpreadsheetData,
} from "@/lib/docArchive/spreadsheetShared";

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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Excel's column "width" is in units of the default font's digit width, not
// pixels — these conversions use the same ~7px-per-unit + 5px-padding
// approximation Excel itself uses for its default Calibri 11 font. Not
// pixel-perfect for other fonts, but close enough to preserve a sheet's
// relative column proportions across an import/export round-trip.
function excelWidthToPx(width: number): number {
  return clamp(Math.round(width * 7 + 5), MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH);
}

function pxToExcelWidth(px: number): number {
  return Math.max(1, Math.round(((px - 5) / 7) * 100) / 100);
}

// Excel row heights are in points (1pt = 4/3px at 96dpi).
function excelHeightToPx(points: number): number {
  return clamp(Math.round((points * 4) / 3), MIN_ROW_HEIGHT, MAX_ROW_HEIGHT);
}

function pxToExcelHeight(px: number): number {
  return Math.round(((px * 3) / 4) * 100) / 100;
}

export async function exportSpreadsheetToExcel(data: SpreadsheetData, filename: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1", { views: [{ state: "frozen", ySplit: 1 }] });

  worksheet.addRow(data.columnNames);
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  data.cells.forEach((row, rowIndex) => {
    const excelRow = worksheet.addRow(row.map((cell) => cell.value));
    row.forEach((cell, columnIndex) => {
      if (!cell.bg) return;
      excelRow.getCell(columnIndex + 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hexToArgb(cell.bg) },
      };
    });
    const rowHeightPx = data.rowHeights?.[rowIndex];
    if (rowHeightPx) excelRow.height = pxToExcelHeight(rowHeightPx);
  });

  worksheet.columns.forEach((column, columnIndex) => {
    const widthPx = data.columnWidths?.[columnIndex];
    column.width = widthPx ? pxToExcelWidth(widthPx) : pxToExcelWidth(DEFAULT_COLUMN_WIDTH);
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

  // worksheet.getColumn(i).width is undefined for a column Excel never had
  // an explicit width set on (still just its silent default) — only carry
  // over a width the source file actually specified, so an unresized column
  // there stays unresized here too rather than locking in an arbitrary px
  // value.
  const columnWidths = Array.from({ length: columnCount }, (_, i) => {
    const width = worksheet.getColumn(i + 1).width;
    return width !== undefined ? excelWidthToPx(width) : undefined;
  });
  const hasColumnWidths = columnWidths.some((w) => w !== undefined);

  const rowCount = Math.min(Math.max(worksheet.rowCount - 1, 0), MAX_ROWS);
  const rowHeights: (number | undefined)[] = [];
  const cells: SheetCell[][] = Array.from({ length: rowCount }, (_, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 2);
    rowHeights.push(excelRow.height !== undefined ? excelHeightToPx(excelRow.height) : undefined);
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
  const hasRowHeights = rowHeights.some((h) => h !== undefined);

  return {
    columnNames,
    cells,
    ...(hasColumnWidths ? { columnWidths: columnWidths.map((w) => w ?? DEFAULT_COLUMN_WIDTH) } : {}),
    ...(hasRowHeights ? { rowHeights: rowHeights.map((h) => h ?? DEFAULT_ROW_HEIGHT) } : {}),
  };
}
