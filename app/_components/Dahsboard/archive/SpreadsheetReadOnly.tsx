"use client";

import { useEffect, useMemo, useState } from "react";
import SpreadsheetImpl, {
  type CellBase,
  type DataViewerProps,
  type Props as SpreadsheetComponentProps,
} from "react-spreadsheet";
import { DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, type SheetCell, type SpreadsheetData } from "@/lib/docArchive/spreadsheetShared";
import { exportSpreadsheetToExcel } from "@/lib/docArchive/spreadsheetExcel";
import { ContentSectionTypeIcon } from "@/app/_components/Dahsboard/archive/ContentSectionTypeIcon";
import { getContentSectionLabel } from "@/lib/docArchive/contentSectionLabels";
import { SheetSizingContext, SizedCell, SizedRow, SizedTable } from "@/app/_components/Dahsboard/archive/spreadsheetGrid";

// Same forwardRef-generics workaround as SpreadsheetPanel — see its comment.
const Spreadsheet = SpreadsheetImpl as unknown as <CellType extends CellBase>(
  props: SpreadsheetComponentProps<CellType>,
) => React.ReactElement;

type ReadOnlyCell = SheetCell & { readOnly: true };

// Same width cap as SpreadsheetPanel's SheetDataViewer — kept in sync so a
// column doesn't render at a different width in view mode vs. edit mode.
const CELL_MAX_WIDTH_CLASS = "block max-w-[240px] whitespace-pre-wrap break-words";

function SheetDataViewer({ cell, evaluatedCell }: DataViewerProps<ReadOnlyCell>) {
  const value = evaluatedCell?.value ?? cell?.value ?? "";
  return <span className={`Spreadsheet__data-viewer ${CELL_MAX_WIDTH_CLASS}`}>{String(value)}</span>;
}

type Props = {
  sectionId: string;
  locale: string;
};

// Read-only counterpart to SpreadsheetPanel — the item view page (ItemView)
// only ever browses, never edits (all mutation lives on the settings page).
// Reuses the same react-spreadsheet grid (marking every cell `readOnly`)
// rather than a plain <table>, so browsing looks identical to editing
// (borders, cell background colors) and selection/copy still work — a
// viewer can still copy a range out even though they can't type into it.
//
// Owns its own header bar (icon + label left, Export button right) rather
// than ItemView rendering one generically for every section type — Export
// only makes sense here, on the read-only view, per explicit request that
// settings (editing) keep Import only and viewing get Export instead; the
// button sits in the same top-right corner ContentSectionCard's up/down/
// delete controls occupy on the settings page, just with a single action.
export function SpreadsheetReadOnly({ sectionId, locale }: Props) {
  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/archive/content-sections/${sectionId}/spreadsheet`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok && body?.ok) setData(body.data);
      if (!cancelled) setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  const readOnlyCells = useMemo<ReadOnlyCell[][]>(
    () => (data ? data.cells.map((row) => row.map((cell): ReadOnlyCell => ({ ...cell, readOnly: true }))) : []),
    [data],
  );

  // Same fallback-to-defaults logic as SpreadsheetPanel's applyLoadedData —
  // a spreadsheet saved before column/row sizing existed just renders at the
  // library defaults here too.
  const sheetSizing = useMemo(
    () => ({
      columnWidths: data?.columnWidths ?? Array.from({ length: data?.columnNames.length ?? 0 }, () => DEFAULT_COLUMN_WIDTH),
      rowHeights: data?.rowHeights ?? Array.from({ length: data?.cells.length ?? 0 }, () => DEFAULT_ROW_HEIGHT),
    }),
    [data],
  );

  function handleExport() {
    if (!data) return;
    void exportSpreadsheetToExcel(data, "spreadsheet.xlsx");
  }

  const label = getContentSectionLabel("SPREADSHEET", locale);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-logoblue">
          <ContentSectionTypeIcon type="SPREADSHEET" className="h-5 w-5 shrink-0" />
          {label.name}
        </h2>
        <button
          type="button"
          className="customButtonDefault text-xs"
          onClick={handleExport}
          disabled={!data}
        >
          {locale === "nb" ? "Eksporter til Excel" : "Export to Excel"}
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 w-full animate-pulse items-center justify-center rounded-xl bg-gray-300">
          <span className="text-sm font-medium text-white">
            {locale === "nb" ? "Laster..." : "Loading..."}
          </span>
        </div>
      ) : !data || data.columnNames.length === 0 || data.cells.length === 0 ? (
        <p className="text-sm text-textColorThird">{locale === "nb" ? "Tomt regneark" : "Empty spreadsheet"}</p>
      ) : (
        <div className="overflow-x-auto">
          <SheetSizingContext.Provider value={sheetSizing}>
            <Spreadsheet<ReadOnlyCell>
              data={readOnlyCells}
              columnLabels={data.columnNames}
              DataViewer={SheetDataViewer}
              Table={SizedTable}
              Row={SizedRow}
              Cell={SizedCell}
            />
          </SheetSizingContext.Provider>
        </div>
      )}
    </div>
  );
}
