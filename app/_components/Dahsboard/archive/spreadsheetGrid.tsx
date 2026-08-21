"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { CellBase, CellComponentProps, Point, RowProps, TableProps } from "react-spreadsheet";
import { DEFAULT_COLUMN_WIDTH } from "@/lib/docArchive/spreadsheetShared";

// Shared table/row/cell rendering for the Spreadsheet content section's grid
// (react-spreadsheet), used by both SpreadsheetPanel (editable) and
// SpreadsheetReadOnly (view-only) so a column/row's size and a cell's
// background color render identically in both places — see each component's
// own comment for why that matters.

// Fixed width for the row-number gutter column — not user-resizable, same
// as react-spreadsheet's own treatment of that column.
const INDICATOR_COLUMN_WIDTH = 40;

export type SheetSizing = {
  columnWidths: number[]; // parallel to columnNames, always fully populated
  rowHeights: number[]; // parallel to cells, always fully populated
};

export const SheetSizingContext = createContext<SheetSizing | null>(null);

// Replaces react-spreadsheet's default Table. The only change from the
// library's own version is giving each data column's <col> an explicit
// width from SheetSizingContext — with `table-layout: fixed` (set below),
// the <col> width is the actual source of truth for that column's rendered
// width, independent of any cell's own content.
export function SizedTable({ children, columns, hideColumnIndicators }: TableProps) {
  const sizing = useContext(SheetSizingContext);
  const columnCount = columns + (hideColumnIndicators ? 0 : 1);
  const cols = Array.from({ length: columnCount }, (_, i) => {
    // Column 0 is the row-indicator gutter, unless indicators are hidden.
    const dataColumnIndex = hideColumnIndicators ? i : i - 1;
    const width =
      dataColumnIndex < 0 ? INDICATOR_COLUMN_WIDTH : (sizing?.columnWidths[dataColumnIndex] ?? DEFAULT_COLUMN_WIDTH);
    return <col key={i} style={{ width }} />;
  });
  return (
    <table className="Spreadsheet__table" style={{ tableLayout: "fixed" }}>
      <colgroup>{cols}</colgroup>
      <tbody>{children}</tbody>
    </table>
  );
}

// Replaces react-spreadsheet's default Row: applies a per-row height from
// SheetSizingContext to the <tr>. A row with no stored height renders at
// the library's own default (undefined style = no override).
export function SizedRow({ row, children }: RowProps) {
  const sizing = useContext(SheetSizingContext);
  const height = sizing?.rowHeights[row];
  return <tr style={height ? { height, maxHeight: "none" } : undefined}>{children}</tr>;
}

function getOffsetRect(element: HTMLElement) {
  return {
    width: element.offsetWidth,
    height: element.offsetHeight,
    left: element.offsetLeft,
    top: element.offsetTop,
  };
}

type BgCell = CellBase & { bg?: string };

// Reimplementation of react-spreadsheet's default Cell component (its
// source isn't exported for reuse/wrapping). Needed so a cell's background
// color paints the actual <td> rather than the DataViewer's inner <span> —
// painting only the span left the <td>'s own padding unfilled (a colored
// rectangle with a plain "halo" around it instead of a solid cell fill),
// which is why an earlier version of this UI shipped with no coloring
// control at all rather than a visibly-broken one.
//
// Every interaction handler below (mouse down/over, dimension tracking,
// active-cell focus-on-activate) is carried over unchanged from the
// library's default Cell — the only additions are the `style` (background
// color + this row's height override) and reading SheetSizingContext.
export function SizedCell<Cell extends BgCell>(props: CellComponentProps<Cell>) {
  const { row, column, DataViewer, selected, active, dragging, mode, data, evaluatedData, select, activate, setCellDimensions, setCellData } =
    props;
  const rootRef = useRef<HTMLTableCellElement | null>(null);
  const sizing = useContext(SheetSizingContext);
  const point = useMemo<Point>(() => ({ row, column }), [row, column]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>) => {
      if (mode === "view") {
        setCellDimensions(point, getOffsetRect(event.currentTarget));
        if (event.shiftKey) select(point);
        else activate(point);
      }
    },
    [mode, setCellDimensions, point, select, activate],
  );

  const handleMouseOver = useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>) => {
      if (dragging) {
        setCellDimensions(point, getOffsetRect(event.currentTarget));
        select(point);
      }
    },
    [setCellDimensions, select, dragging, point],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (selected && root) setCellDimensions(point, getOffsetRect(root));
    if (root && active && mode === "view") root.focus();
  }, [setCellDimensions, selected, active, mode, point, data]);

  const height = sizing?.rowHeights[row];

  return (
    <td
      ref={rootRef}
      className={`Spreadsheet__cell${data?.readOnly ? " Spreadsheet__cell--readonly" : ""}`}
      style={{
        backgroundColor: data?.bg,
        ...(height ? { height, maxHeight: "none", minHeight: height } : undefined),
      }}
      onMouseOver={handleMouseOver}
      onMouseDown={handleMouseDown}
      tabIndex={0}
    >
      <DataViewer row={row} column={column} cell={data} evaluatedCell={evaluatedData} setCellData={setCellData} />
    </td>
  );
}

// Starts a mouse-drag resize (used by both the column-width and row-height
// resize handles). `axis` picks which pointer coordinate drives the delta;
// `onChange` is called continuously as the mouse moves so the grid resizes
// live, matching how dragging a column/row border behaves in a normal
// spreadsheet app.
export function beginResizeDrag(
  event: React.MouseEvent,
  axis: "x" | "y",
  startSize: number,
  min: number,
  max: number,
  onChange: (size: number) => void,
) {
  event.preventDefault();
  event.stopPropagation();
  const startPos = axis === "x" ? event.clientX : event.clientY;

  function handleMove(moveEvent: MouseEvent) {
    const pos = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
    onChange(Math.min(max, Math.max(min, startSize + (pos - startPos))));
  }
  function handleUp() {
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleUp);
  }
  document.addEventListener("mousemove", handleMove);
  document.addEventListener("mouseup", handleUp);
}
