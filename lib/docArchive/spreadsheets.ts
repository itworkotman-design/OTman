import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  MAX_COLUMNS,
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MAX_ROWS,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  defaultSpreadsheetData,
  type SpreadsheetData,
} from "@/lib/docArchive/spreadsheetShared";

export type { SheetCell, SpreadsheetData } from "@/lib/docArchive/spreadsheetShared";

// Host-side "spreadsheet" item content, alongside the archive package's own
// file storage — same reasoning as ArchiveItemTextField: the package has no
// tabular/structured-data storage (see
// docs/documentation/integrations/archive-ui-known-gaps.md). Shaped to
// match the react-spreadsheet library's own `data`/`columnLabels` props
// almost 1:1 (see SpreadsheetPanel), so persisting is a near-direct
// round-trip with no id-based reconciliation layer. Rows/columns are plain
// arrays addressed by index — fine since nothing outside one save cycle
// holds onto a "row 3" reference (no drag-reorder in scope).
//
// Types/size caps live in spreadsheetShared.ts, not here — that module has
// zero dependencies, so client components (SpreadsheetPanel,
// spreadsheetExcel.ts) can import them without pulling this file's Prisma
// import into the browser bundle.
const MAX_CELL_VALUE_LENGTH = 5000;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Provisioned lazily on first read, same idea as
// contentSections.ts's getOrCreateDefaultSections — a SPREADSHEET section
// always exists once its picker tile is clicked (createContentSection), but
// its grid content is only materialized the first time someone opens it.
//
// The find-then-create isn't atomic, and two GET requests for a
// freshly-added section can genuinely race (React double-invoking the
// panel's load effect in dev, a second browser tab, etc — same situation
// getOrCreateDefaultSections handles for sections themselves). Both requests
// can see `existing === null` before either commits, so the loser's create
// hits ArchiveItemSpreadsheet's `sectionId` unique constraint (P2002) —
// recovered by just re-reading the row the winner created, same value
// either way since `data` only depends on sectionId, not on which request
// wrote it.
export async function getOrCreateSpreadsheet(
  companyId: string,
  tenantId: string,
  itemId: string,
  sectionId: string,
): Promise<SpreadsheetData> {
  const existing = await prisma.archiveItemSpreadsheet.findFirst({
    where: { sectionId, companyId, tenantId },
    select: { data: true },
  });
  if (existing) return existing.data as SpreadsheetData;

  const data = defaultSpreadsheetData();
  try {
    await prisma.archiveItemSpreadsheet.create({
      data: { companyId, tenantId, itemId, sectionId, data },
    });
    return data;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.archiveItemSpreadsheet.findFirst({
        where: { sectionId, companyId, tenantId },
        select: { data: true },
      });
      if (winner) return winner.data as SpreadsheetData;
    }
    throw error;
  }
}

export type UpdateSpreadsheetResult = { ok: true } | { ok: false; reason: "INVALID_DATA" };

function isValidSizeArray(value: unknown, expectedLength: number, min: number, max: number): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length !== expectedLength) return false;
  return value.every((n) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max);
}

function isValidSpreadsheetData(data: unknown): data is SpreadsheetData {
  if (!data || typeof data !== "object") return false;
  const { columnNames, cells, columnWidths, rowHeights } = data as Record<string, unknown>;

  if (!Array.isArray(columnNames) || columnNames.length > MAX_COLUMNS) return false;
  if (!columnNames.every((name) => typeof name === "string")) return false;

  if (!Array.isArray(cells) || cells.length > MAX_ROWS) return false;

  if (!isValidSizeArray(columnWidths, columnNames.length, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH)) return false;
  if (!isValidSizeArray(rowHeights, cells.length, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT)) return false;

  return cells.every((row) => {
    if (!Array.isArray(row) || row.length !== columnNames.length) return false;
    return row.every((cell) => {
      if (!cell || typeof cell !== "object") return false;
      const { value, bg } = cell as Record<string, unknown>;
      if (typeof value !== "string" || value.length > MAX_CELL_VALUE_LENGTH) return false;
      if (bg !== undefined && (typeof bg !== "string" || !HEX_COLOR_PATTERN.test(bg))) return false;
      return true;
    });
  });
}

export async function updateSpreadsheet(
  companyId: string,
  tenantId: string,
  itemId: string,
  sectionId: string,
  data: unknown,
): Promise<UpdateSpreadsheetResult> {
  if (!isValidSpreadsheetData(data)) return { ok: false, reason: "INVALID_DATA" };

  await prisma.archiveItemSpreadsheet.upsert({
    where: { sectionId },
    create: { companyId, tenantId, itemId, sectionId, data },
    update: { data },
  });

  return { ok: true };
}
