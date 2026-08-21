// Types/constants shared between the server-side store (spreadsheets.ts,
// which imports the Prisma client) and client-side code (SpreadsheetPanel,
// spreadsheetExcel.ts). Kept in its own zero-dependency module so importing
// these from a "use client" component never drags Prisma into the browser
// bundle.
export type SheetCell = { value: string; bg?: string }; // bg = "#rrggbb"
// columnWidths/rowHeights are optional and, when present, parallel
// columnNames/cells by index (columnWidths[i] is column i's width in px,
// rowHeights[i] is row i's height in px). Missing entirely, or a missing/
// undefined slot within the array, means "render at the library default" —
// so a spreadsheet nobody has resized yet stores nothing extra.
export type SpreadsheetData = {
  columnNames: string[];
  cells: SheetCell[][]; // cells[row][col]
  columnWidths?: number[];
  rowHeights?: number[];
};

export const MAX_ROWS = 200;
export const MAX_COLUMNS = 50;

const DEFAULT_COLUMN_COUNT = 5;
const DEFAULT_ROW_COUNT = 8;
const DEFAULT_COLUMN_NAMES = ["A", "B", "C", "D", "E"];

// Sizing bounds for the column-width/row-height resize handles, and the
// fallback used when a column/row has no stored size yet. MIN_*/DEFAULT_*
// deliberately equal react-spreadsheet's own built-in CSS floor (`min-width:
// 6em`, `min-height: 1.9em`, i.e. ~96px/~30px at the app's base font size) —
// the grid can only be resized to be BIGGER than that CSS floor, not
// smaller, so the custom sizing never has to fight the library's own
// baked-in minimum (which would otherwise silently keep a "shrunk" column/
// row rendering at its old size).
export const MIN_COLUMN_WIDTH = 96;
export const MAX_COLUMN_WIDTH = 480;
export const DEFAULT_COLUMN_WIDTH = 96;
export const MIN_ROW_HEIGHT = 30;
export const MAX_ROW_HEIGHT = 300;
export const DEFAULT_ROW_HEIGHT = 30;

// Shared so a pending (not-yet-created) SPREADSHEET section can show the
// exact same starting grid client-side, before a real sectionId exists to
// fetch from — see SpreadsheetPanel's `sectionId: null` handling.
export function defaultSpreadsheetData(): SpreadsheetData {
  return {
    columnNames: DEFAULT_COLUMN_NAMES.slice(0, DEFAULT_COLUMN_COUNT),
    cells: Array.from({ length: DEFAULT_ROW_COUNT }, () =>
      Array.from({ length: DEFAULT_COLUMN_COUNT }, () => ({ value: "" })),
    ),
  };
}
