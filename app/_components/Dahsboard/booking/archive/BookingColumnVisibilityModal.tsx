"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { BookingArchiveViewMode } from "./types";
import {
  getBookingArchiveColumns,
  type BookingArchiveColumnId,
} from "@/lib/booking/archiveColumns";

type Props = {
  open: boolean;
  viewMode: BookingArchiveViewMode;
  visibleColumnIds: BookingArchiveColumnId[];
  onToggleColumn: (columnId: BookingArchiveColumnId) => void;
  onReset: () => void;
  onClose: () => void;
};

export default function BookingColumnVisibilityModal({
  open,
  viewMode,
  visibleColumnIds,
  onToggleColumn,
  onReset,
  onClose,
}: Props) {
  const columns = getBookingArchiveColumns(viewMode);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="customContainer w-full max-w-[640] bg-white"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-column-visibility-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="booking-column-visibility-title"
              className="text-2xl font-semibold text-logoblue"
            >
              Hide columns
            </h2>
            <p className="mt-2 text-sm text-textColorThird">
              Hidden columns are removed from the table and from Excel export.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white"
            aria-label="Close column visibility modal"
          >
            x
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {columns.map((column) => {
            const checked = visibleColumnIds.includes(column.id);
            const disableToggle = checked && visibleColumnIds.length === 1;

            return (
              <label
                key={column.id}
                className="flex items-start gap-3 rounded-xl border border-black/8 px-4 py-3"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={disableToggle}
                  onChange={() => onToggleColumn(column.id)}
                />

                <span className="min-w-0">
                  <span className="block font-medium text-logoblue">
                    {column.label}
                  </span>
                  <span className="block text-xs text-textColorThird">
                    {column.exportHeader
                      ? "Visible in table and Excel export"
                      : "Visible in table only"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onReset}
            className="customButtonDefault"
          >
            Show all
          </button>

          <button
            type="button"
            onClick={onClose}
            className="customButtonEnabled"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
