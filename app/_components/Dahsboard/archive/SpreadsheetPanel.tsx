"use client";

import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import SpreadsheetImpl, {
  type CellBase,
  type ColumnIndicatorProps,
  type DataViewerProps,
  type Matrix,
  type Props as SpreadsheetComponentProps,
  type RowIndicatorProps,
  type Selection,
} from "react-spreadsheet";
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  defaultSpreadsheetData,
  type SheetCell,
  type SpreadsheetData,
} from "@/lib/docArchive/spreadsheetShared";
import { importSpreadsheetFromExcelFile } from "@/lib/docArchive/spreadsheetExcel";
import { SheetSizingContext, SizedCell, SizedRow, SizedTable, beginResizeDrag } from "@/app/_components/Dahsboard/archive/spreadsheetGrid";

// Preset fill-color swatches offered in the toolbar, alongside a native
// color picker for anything else — soft/pastel so text stays readable on
// top without also requiring a text-color control.
const COLOR_PRESETS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa"];

function fillArray(length: number, value: number): number[] {
  return Array.from({ length }, () => value);
}

// react-spreadsheet's default export is wrapped in React.forwardRef, which
// TypeScript can't keep generic through — its published type flattens
// CellType to CellBase<any>. Re-casting it back to a generic function type
// (a standard forwardRef+generics workaround) lets `<Spreadsheet<SheetCell>>`
// below type-check DataViewer/ColumnIndicator/RowIndicator against our own
// SheetCell shape instead of the erased `any`.
const Spreadsheet = SpreadsheetImpl as unknown as <CellType extends CellBase>(
  props: SpreadsheetComponentProps<CellType>,
) => React.ReactElement;

export type SpreadsheetPanelHandle = {
  // Takes the section's real id as a call-time argument — same reasoning as
  // TextFieldsPanelHandle.flushPendingAdds (a pending section has no real id
  // until Save's first phase creates it).
  flushPendingChanges: (sectionId: string) => Promise<void>;
};

type SpreadsheetPanelProps = {
  // `null` means a not-yet-created (pending) section — nothing to fetch yet,
  // starts from an empty sheet until a real id exists.
  sectionId: string | null;
  locale: string;
  onDirtyChange?: (dirty: boolean) => void;
};

function columnIndexToLetters(index: number): string {
  let label = "";
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

// Picks the next default column name from existing column count/position
// alone (e.g. columnIndexToLetters(columnNames.length)) collides once any
// earlier column has been deleted — deleting "A" then adding a column lands
// back on "B", "C", etc, which already exist. Scanning for the lowest letter
// not currently in use keeps every default name unique regardless of prior
// deletions, without needing any extra id/counter state.
function nextUnusedColumnName(existingNames: string[]): string {
  const used = new Set(existingNames);
  for (let i = 0; i < 10000; i++) {
    const candidate = columnIndexToLetters(i);
    if (!used.has(candidate)) return candidate;
  }
  return columnIndexToLetters(existingNames.length);
}

function emptyRow(columnCount: number): SheetCell[] {
  return Array.from({ length: columnCount }, () => ({ value: "" }));
}

// Custom header actions (rename/delete column, delete row) are threaded
// through context rather than as props on the ColumnIndicator/RowIndicator
// components themselves: react-spreadsheet's ColumnIndicator/RowIndicator
// prop slots have a fixed signature ({column|row, label, selected,
// onSelect}) with no room for extras, and the components passed there must
// keep a STABLE identity across renders (recreating the function inline
// each render would remount them — and drop focus — on every keystroke of
// an in-progress rename). Context lets the module-scope components below
// stay referentially stable while still reaching this instance's latest
// handlers; multiple SpreadsheetPanel instances on one page each get their
// own Provider, so the shared module-level Context object still resolves
// per-instance.
type SheetActions = {
  locale: string;
  canDeleteColumn: boolean;
  canDeleteRow: boolean;
  onRenameColumn: (column: number, name: string) => void;
  onDeleteColumn: (column: number) => void;
  onDeleteRow: (row: number) => void;
  onResizeColumn: (column: number, width: number) => void;
  onResizeRow: (row: number, height: number) => void;
};

const SheetActionsContext = createContext<SheetActions | null>(null);

// Capped so a cell holding a long, unbroken run of text (common straight
// after an Excel import) can't stretch its whole column arbitrarily wide —
// it wraps onto multiple lines within this width instead, growing the row's
// height rather than the column's width.
const CELL_MAX_WIDTH_CLASS = "block max-w-[240px] whitespace-pre-wrap break-words";

function SheetDataViewer({ cell, evaluatedCell }: DataViewerProps<SheetCell>) {
  const value = evaluatedCell?.value ?? cell?.value ?? "";
  return <span className={`Spreadsheet__data-viewer ${CELL_MAX_WIDTH_CLASS}`}>{String(value)}</span>;
}

function SheetColumnIndicator({ column, label, selected, onSelect }: ColumnIndicatorProps) {
  const actions = useContext(SheetActionsContext);
  const sizing = useContext(SheetSizingContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!actions) return null;

  function startEdit() {
    setDraft(typeof label === "string" ? label : "");
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed) actions!.onRenameColumn(column, trimmed);
  }

  return (
    <th
      className={`Spreadsheet__header group relative ${selected ? "Spreadsheet__header--selected" : ""}`}
      onClick={(e) => !editing && onSelect(column, e.shiftKey)}
    >
      <div className="flex items-center justify-center gap-1">
        {editing ? (
          <input
            autoFocus
            className="w-16 min-w-0 rounded border border-logoblue px-1 text-xs text-textcolor"
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <span className="truncate" onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}>
            {label}
          </span>
        )}
        {actions.canDeleteColumn && !editing && (
          <button
            type="button"
            className="hidden shrink-0 text-red-600 group-hover:inline"
            aria-label={actions.locale === "nb" ? "Slett kolonne" : "Delete column"}
            onClick={(e) => {
              e.stopPropagation();
              actions.onDeleteColumn(column);
            }}
          >
            ×
          </button>
        )}
      </div>
      <div
        role="presentation"
        title={actions.locale === "nb" ? "Dra for å endre kolonnebredde" : "Drag to resize column"}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize opacity-0 hover:bg-logoblue/50 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          const start = sizing?.columnWidths[column] ?? DEFAULT_COLUMN_WIDTH;
          beginResizeDrag(e, "x", start, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, (next) => actions.onResizeColumn(column, next));
        }}
      />
    </th>
  );
}

function SheetRowIndicator({ row, label, selected, onSelect }: RowIndicatorProps) {
  const actions = useContext(SheetActionsContext);
  const sizing = useContext(SheetSizingContext);
  if (!actions) return null;

  return (
    <th
      className={`Spreadsheet__header group relative ${selected ? "Spreadsheet__header--selected" : ""}`}
      onClick={(e) => onSelect(row, e.shiftKey)}
    >
      <div className="flex items-center justify-center gap-1">
        <span>{label !== undefined && label !== null ? label : row + 1}</span>
        {actions.canDeleteRow && (
          <button
            type="button"
            className="hidden shrink-0 text-red-600 group-hover:inline"
            aria-label={actions.locale === "nb" ? "Slett rad" : "Delete row"}
            onClick={(e) => {
              e.stopPropagation();
              actions.onDeleteRow(row);
            }}
          >
            ×
          </button>
        )}
      </div>
      <div
        role="presentation"
        title={actions.locale === "nb" ? "Dra for å endre radhøyde" : "Drag to resize row"}
        className="absolute bottom-0 left-0 h-1.5 w-full cursor-row-resize opacity-0 hover:bg-logoblue/50 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          const start = sizing?.rowHeights[row] ?? DEFAULT_ROW_HEIGHT;
          beginResizeDrag(e, "y", start, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, (next) => actions.onResizeRow(row, next));
        }}
      />
    </th>
  );
}

// A full editable spreadsheet content section — the tabular counterpart to
// TextFieldsPanel, backed by ArchiveItemSpreadsheet (see
// lib/docArchive/spreadsheets.ts). Grid mechanics (rectangular drag-select,
// shift-click extend, whole-row/column select, and clipboard copy/cut/paste
// in Excel's own tab-separated format) all come from the react-spreadsheet
// library for free; this component supplies add/remove row & column, column
// renaming, and Excel import on top of it. Export lives on the read-only
// item view page instead (SpreadsheetReadOnly) — per explicit request that
// editing (settings) and exporting (viewing) not share one toolbar.
//
// Cell background coloring, column-width and row-height resizing all render
// through SizedTable/SizedRow/SizedCell (spreadsheetGrid.tsx) — a custom
// Cell that paints background color on the actual <td> rather than the
// DataViewer's inner <span>. An earlier version of this UI shipped with no
// coloring control at all because painting the span left the <td>'s own
// padding unfilled (a colored rectangle with a plain "halo" around it), and
// that fix is what made it worth exposing a color picker here.
export const SpreadsheetPanel = forwardRef<SpreadsheetPanelHandle, SpreadsheetPanelProps>(function SpreadsheetPanel(
  { sectionId, locale, onDirtyChange },
  ref,
) {
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [cells, setCells] = useState<SheetCell[][]>([]);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<SpreadsheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalizes a just-loaded (or freshly-defaulted) SpreadsheetData into a
  // fully-populated shape — columnWidths/rowHeights filled in when the
  // stored data predates this feature (or is the pending-section default,
  // which never has them either) — and applies it to every piece of state
  // at once, including savedSnapshot. savedSnapshot MUST end up in this same
  // fully-populated shape, not the possibly-sparse shape straight off the
  // wire: the `dirty` check below does a plain JSON.stringify comparison
  // against live state (which is always fully-populated), so a savedSnapshot
  // missing these keys would make `dirty` true immediately on load for any
  // spreadsheet nobody has resized yet.
  function applyLoadedData(data: SpreadsheetData) {
    const normalized: SpreadsheetData = {
      columnNames: data.columnNames,
      cells: data.cells,
      columnWidths: data.columnWidths ?? fillArray(data.columnNames.length, DEFAULT_COLUMN_WIDTH),
      rowHeights: data.rowHeights ?? fillArray(data.cells.length, DEFAULT_ROW_HEIGHT),
    };
    setColumnNames(normalized.columnNames);
    setCells(normalized.cells);
    setColumnWidths(normalized.columnWidths!);
    setRowHeights(normalized.rowHeights!);
    setSavedSnapshot(normalized);
  }

  async function load() {
    if (!sectionId) {
      // Pending section — nothing to fetch yet. Seed with the same default
      // grid the server would lazily create on first real GET, and treat it
      // as already-"saved" so an untouched pending section doesn't spuriously
      // report dirty (see the module comment on defaultSpreadsheetData).
      applyLoadedData(defaultSpreadsheetData());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/archive/content-sections/${sectionId}/spreadsheet`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        applyLoadedData(body.data);
      } else {
        setError(body?.reason || "Failed to load spreadsheet");
      }
    } catch {
      setError("Failed to load spreadsheet");
    } finally {
      setLoading(false);
    }
  }

  // Tracks the `sectionId` this instance has actually loaded for —
  // `undefined` means never loaded. Reordering this section within
  // ContentSectionList's list (even via the plain up/down buttons, no
  // drag-and-drop involved) can make this effect re-run with `sectionId`
  // completely UNCHANGED — a keyed-list quirk that shows up reliably under
  // StrictMode (React re-associates this fiber's effect during the
  // reorder's reconciliation) though the component itself never remounts.
  // Comparing against the dependency array alone isn't enough to catch
  // that, since `[sectionId]` "changing" is exactly what React itself
  // fails to rule out here — so this checks the ACTUAL last-loaded id
  // instead, and skips entirely (no fetch, no reset-to-default) whenever
  // it's unchanged, which is what a spurious re-run always looks like.
  //
  // The one legitimate case where `sectionId` truly changes without a
  // fetch being safe is the pending-section-just-got-created transition
  // (null -> real id), which ContentSectionList's Save triggers via
  // setSections BEFORE it calls flushPendingChanges (see that function's
  // own comment on why it takes the id as a call-time argument rather than
  // waiting on this prop). A section that was pending a moment ago can't
  // have any server-side data yet — refetching here would race
  // flushPendingChanges and can win, clobbering `columnNames`/`cells` back
  // to the default grid (making `dirty` false) right before the flush loop
  // reads it, silently dropping whatever was just edited. Adopting the new
  // id without a fetch keeps local state (and its dirty-ness) exactly
  // as-is, so the flush that's about to happen still sees it.
  const loadedForRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (loadedForRef.current === sectionId) return;
    const wasPending = loadedForRef.current === null;
    loadedForRef.current = sectionId;
    if (sectionId && wasPending) return;

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const dirty = useMemo(() => {
    if (!savedSnapshot) return false;
    return JSON.stringify({ columnNames, cells, columnWidths, rowHeights }) !== JSON.stringify(savedSnapshot);
  }, [columnNames, cells, columnWidths, rowHeights, savedSnapshot]);

  useEffect(() => {
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  useImperativeHandle(ref, () => ({
    async flushPendingChanges(resolvedSectionId: string) {
      if (!dirty) return;

      try {
        setError("");
        const data: SpreadsheetData = { columnNames, cells, columnWidths, rowHeights };
        const res = await fetch(`/api/archive/content-sections/${resolvedSectionId}/spreadsheet`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          setError(body?.reason || "Failed to save spreadsheet");
          return;
        }
        setSavedSnapshot(data);
      } catch {
        setError("Failed to save spreadsheet");
      }
    },
  }));

  function handleAddRow() {
    setCells((prev) => [...prev, emptyRow(columnNames.length)]);
    setRowHeights((prev) => [...prev, DEFAULT_ROW_HEIGHT]);
  }

  function handleAddColumn() {
    setColumnNames((prev) => [...prev, nextUnusedColumnName(prev)]);
    setCells((prev) => prev.map((row) => [...row, { value: "" }]));
    setColumnWidths((prev) => [...prev, DEFAULT_COLUMN_WIDTH]);
  }

  function handleRenameColumn(column: number, name: string) {
    setColumnNames((prev) => prev.map((n, i) => (i === column ? name : n)));
  }

  function handleDeleteColumn(column: number) {
    setColumnNames((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== column)));
    setCells((prev) => (columnNames.length <= 1 ? prev : prev.map((row) => row.filter((_, i) => i !== column))));
    setColumnWidths((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== column)));
  }

  function handleDeleteRow(row: number) {
    setCells((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== row)));
    setRowHeights((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== row)));
  }

  function handleResizeColumn(column: number, width: number) {
    setColumnWidths((prev) => prev.map((w, i) => (i === column ? width : w)));
  }

  function handleResizeRow(row: number, height: number) {
    setRowHeights((prev) => prev.map((h, i) => (i === row ? height : h)));
  }

  function applyColorToSelection(bg: string | undefined) {
    if (!selection) return;
    const range = selection.toRange(cells);
    if (!range) return;
    setCells((prev) => prev.map((row, r) => row.map((cell, c) => (range.has({ row: r, column: c }) ? { ...cell, bg } : cell))));
  }

  const hasSelection = useMemo(() => !!(selection && selection.toRange(cells)), [selection, cells]);

  // react-spreadsheet's Matrix<T> allows undefined holes (sparse rows), and
  // in practice its internal model can grow a single edited row's length
  // without growing every other row in lockstep (e.g. typing into a cell at
  // a column index beyond that row's current bounds). Left unchecked, that
  // produces a `cells` matrix with unequal row lengths, which the save
  // endpoint's isValidSpreadsheetData rejects outright — and once a ragged
  // shape like that got saved, every later save would keep failing the same
  // way. Every row is force-padded/truncated to exactly columnNames.length
  // here so `cells` can never leave this component in that shape.
  function handleGridChange(next: Matrix<SheetCell>) {
    const columnCount = columnNames.length;
    setCells(
      next.map((row) => Array.from({ length: columnCount }, (_, i) => row[i] ?? { value: "" })),
    );
  }

  async function handleImportFile(file: File) {
    if (!confirm(locale === "nb" ? "Dette erstatter hele regnearket. Fortsette?" : "This replaces the whole spreadsheet. Continue?")) {
      return;
    }

    try {
      setImporting(true);
      setError("");
      const data = await importSpreadsheetFromExcelFile(file);
      const importedColumnNames = data.columnNames.length > 0 ? data.columnNames : ["A"];
      const importedCells = data.cells.length > 0 ? data.cells : [emptyRow(Math.max(data.columnNames.length, 1))];
      setColumnNames(importedColumnNames);
      setCells(importedCells);
      // The Excel file's own column widths/row heights, when it had any —
      // per the user-facing request that importing from Excel should carry
      // over the source file's sizing, not just its values/colors.
      setColumnWidths(
        data.columnWidths?.slice(0, importedColumnNames.length) ?? fillArray(importedColumnNames.length, DEFAULT_COLUMN_WIDTH),
      );
      setRowHeights(data.rowHeights?.slice(0, importedCells.length) ?? fillArray(importedCells.length, DEFAULT_ROW_HEIGHT));
    } catch {
      setError(locale === "nb" ? "Kunne ikke importere filen" : "Failed to import file");
    } finally {
      setImporting(false);
    }
  }

  const sheetActions = useMemo<SheetActions>(
    () => ({
      locale,
      canDeleteColumn: columnNames.length > 1,
      canDeleteRow: cells.length > 1,
      onRenameColumn: handleRenameColumn,
      onDeleteColumn: handleDeleteColumn,
      onDeleteRow: handleDeleteRow,
      onResizeColumn: handleResizeColumn,
      onResizeRow: handleResizeRow,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, columnNames.length, cells.length],
  );

  const sheetSizing = useMemo(() => ({ columnWidths, rowHeights }), [columnWidths, rowHeights]);

  if (loading) {
    return <p className="text-sm text-textColorThird">{locale === "nb" ? "Laster..." : "Loading..."}</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="customButtonDefault cursor-pointer text-xs">
          {importing ? (locale === "nb" ? "Importerer..." : "Importing...") : locale === "nb" ? "Importer fra Excel" : "Import from Excel"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleImportFile(file);
            }}
          />
        </label>

        <div className="flex items-center gap-1.5 border-l border-lineSecondary pl-3">
          <span className="text-xs text-textColorThird">
            {locale === "nb" ? "Fyllfarge:" : "Fill color:"}
          </span>
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              disabled={!hasSelection}
              // Clicking a toolbar button normally steals DOM focus away
              // from the currently-focused cell — react-spreadsheet treats
              // that as a blur of the whole grid and clears its selection
              // (see the library's own blur() reducer), which raced ahead
              // of this button's own onClick and made "hasSelection" false
              // by the time the color would have applied. Preventing the
              // mousedown's default focus change keeps the grid's selection
              // intact, exactly like a rich-text toolbar button guarding
              // against losing the text selection it's about to act on.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyColorToSelection(color)}
              title={locale === "nb" ? "Fargelegg valgte celler" : "Color the selected cells"}
              className="h-5 w-5 shrink-0 rounded border border-lineSecondary disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: color }}
            />
          ))}
          <input
            type="color"
            disabled={!hasSelection}
            onMouseDown={(e) => e.preventDefault()}
            onChange={(e) => applyColorToSelection(e.target.value)}
            title={locale === "nb" ? "Egendefinert farge" : "Custom color"}
            className="h-5 w-6 shrink-0 cursor-pointer rounded border border-lineSecondary bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-40"
          />
          <button
            type="button"
            disabled={!hasSelection}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyColorToSelection(undefined)}
            className="customButtonDefault text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            {locale === "nb" ? "Fjern farge" : "Clear color"}
          </button>
          {!hasSelection && (
            <span className="text-xs text-textColorThird">
              {locale === "nb" ? "Velg celler først" : "Select cells first"}
            </span>
          )}
        </div>
      </div>

      {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}

      <SheetActionsContext.Provider value={sheetActions}>
        <SheetSizingContext.Provider value={sheetSizing}>
          <div className="overflow-x-auto">
            {/* inline-block shrinks to the table's own natural width, so the
                trailing add-row strip below (w-full) lines up under it exactly
                instead of stretching to the scroll container's full width. */}
            <div className="inline-block">
              <div className="flex items-stretch">
                <Spreadsheet<SheetCell>
                  data={cells}
                  columnLabels={columnNames}
                  onChange={handleGridChange}
                  onSelect={setSelection}
                  DataViewer={SheetDataViewer}
                  ColumnIndicator={SheetColumnIndicator}
                  RowIndicator={SheetRowIndicator}
                  Table={SizedTable}
                  Row={SizedRow}
                  Cell={SizedCell}
                />
                <button
                  type="button"
                  onClick={handleAddColumn}
                  aria-label={locale === "nb" ? "Legg til kolonne" : "Add column"}
                  title={locale === "nb" ? "Legg til kolonne" : "Add column"}
                  className="flex w-8 shrink-0 items-center justify-center border-2 border-dashed border-lineSecondary text-textColorThird transition-colors hover:border-logoblue hover:bg-linePrimary/40 hover:text-logoblue"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddRow}
                aria-label={locale === "nb" ? "Legg til rad" : "Add row"}
                title={locale === "nb" ? "Legg til rad" : "Add row"}
                className="flex h-8 w-full items-center justify-center border-2 border-dashed border-lineSecondary text-textColorThird transition-colors hover:border-logoblue hover:bg-linePrimary/40 hover:text-logoblue"
              >
                +
              </button>
            </div>
          </div>
        </SheetSizingContext.Provider>
      </SheetActionsContext.Provider>
    </div>
  );
});
