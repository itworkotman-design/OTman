// Types/constants shared between the server-side store (spreadsheets.ts,
// which imports the Prisma client) and client-side code (SpreadsheetPanel,
// spreadsheetExcel.ts). Kept in its own zero-dependency module so importing
// these from a "use client" component never drags Prisma into the browser
// bundle.
export type SheetCell = { value: string; bg?: string }; // bg = "#rrggbb"
export type SpreadsheetData = { columnNames: string[]; cells: SheetCell[][] }; // cells[row][col]

export const MAX_ROWS = 200;
export const MAX_COLUMNS = 50;

const DEFAULT_COLUMN_COUNT = 5;
const DEFAULT_ROW_COUNT = 8;
const DEFAULT_COLUMN_NAMES = ["A", "B", "C", "D", "E"];

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
