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

// react-spreadsheet evaluates any cell value starting with "=" as a formula
// on its own (it bundles fast-formula-parser internally — see
// SpreadsheetPanel's module comment), so a formula is just a plain string in
// SheetCell.value; no separate "is this a formula" field is needed anywhere
// else in this app. This function only has to translate that convention to
// and from exceljs's own formula representation (a `{ formula }` object, not
// a string) when crossing the .xlsx boundary.
function toExcelCellValue(value: string): ExcelJS.CellValue {
  if (value.length > 1 && value[0] === "=") {
    return { formula: shiftFormulaRowRefs(value.slice(1), 1) };
  }
  return value;
}

// A cell reference token: optional "$", 1-3 letters (Excel's own column-name
// bound, so this can't over-match into a 4+ letter word), optional "$", then
// digits. Guarded on both sides so it only matches a reference that stands
// on its own — not the leading letters+digits of a function name that just
// happens to look like one (LOG10, ATAN2, BIN2DEC, IMLOG2, HEX2OCT, and
// several dozen more in fast-formula-parser's 280-function library all have
// this shape). A real reference is never immediately followed by "(" (that
// makes it a function call) or by another identifier character (that makes
// it the middle of a longer word), and is never immediately preceded by one
// either (that makes IT the middle of a longer word).
const CELL_REF_PATTERN = /(?<![A-Za-z0-9_.])(\$?[A-Za-z]{1,3}\$?)(\d+)(?![A-Za-z0-9_(])/g;

// Excel's row numbering includes the header row (row 1), but
// react-spreadsheet's own row numbering starts at 1 for the first DATA row
// — it never sees the header row at all, since columnNames is a separate
// field from cells. A row-relative reference inside an imported formula
// therefore points one row too high once the header is stripped out (Excel
// row 2 == react-spreadsheet row 1), and the reverse is true on export once
// the header row is written back in. Column letters are unaffected — column
// order is preserved 1:1 on both sides.
//
// This is a plain regex substitution, not a real formula tokenizer, so it
// can't distinguish a cell reference from a look-alike string literal
// inside the formula (e.g. a text argument like "Sheet A1") — an accepted,
// narrow limitation given fast-formula-parser doesn't expose its own lexer
// for reuse. Row 1 (delta -1 landing on 0, i.e. a reference to the header
// row itself) has no equivalent cell post-import and is left unshifted
// rather than produced as an invalid "row 0" reference.
function shiftFormulaRowRefs(formula: string, delta: number): string {
  return formula.replace(CELL_REF_PATTERN, (match, colPart: string, rowDigits: string) => {
    const row = parseInt(rowDigits, 10) + delta;
    return row >= 1 ? `${colPart}${row}` : match;
  });
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
    const excelRow = worksheet.addRow(row.map((cell) => toExcelCellValue(cell.value)));
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

// Rich text/dates aren't part of this section's scope (plain text/number
// cells only, plus formulas — see below) — any other non-primitive cell
// value is flattened to a display string rather than preserved structurally.
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

// Formula cells import as the formula text itself (react-spreadsheet's own
// convention for a formula — see toExcelCellValue above), not their cached
// result — so the grid re-evaluates them live (via react-spreadsheet's
// bundled fast-formula-parser) instead of freezing in whatever value Excel
// last computed. A "shared formula" cell (Excel's optimization for a
// formula repeated across a range) resolves its own absolute `.formula`
// through exceljs when present; on the rare cell where exceljs can't
// resolve it, this falls back to the cached result like any other value.
function excelCellToSheetValue(value: ExcelJS.CellValue): string {
  if (value !== null && typeof value === "object" && "formula" in value && typeof value.formula === "string") {
    return `=${shiftFormulaRowRefs(value.formula, -1)}`;
  }
  return cellValueToDisplayString(value);
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
      const value = excelCellToSheetValue(excelCell.value);
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
