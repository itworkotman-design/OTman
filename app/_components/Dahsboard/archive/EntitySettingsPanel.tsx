"use client";

import { useState } from "react";
import type { ArchiveBusinessStatus } from "./types";

type EntitySettingsPanelProps = {
  kind: "item" | "folder";
  id: string;
  name: string;
  description: string | null;
  status: ArchiveBusinessStatus;
  dueAt: string | null;
  expiresAt: string | null;
  locale: string;
  onSaved: (updated: { status: ArchiveBusinessStatus; dueAt: string | null; expiresAt: string | null }) => void;
};

const STATUS_OPTIONS: ArchiveBusinessStatus[] = ["active", "draft", "inactive", "archived"];

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// The backend has no rename/edit capability for name/description (a known,
// previously-documented gap in @customprojects/custom-archive — no such
// method exists) — those fields are shown read-only. Status and due/expiry
// dates are real, previously-unused capabilities (setItemStatus/setItemDates/
// setFolderStatus/setFolderDates existed in the package all along but were
// only reachable through the UI-lab RPC dispatcher until now).
export function EntitySettingsPanel({ kind, id, name, description, status, dueAt, expiresAt, locale, onSaved }: EntitySettingsPanelProps) {
  const [nextStatus, setNextStatus] = useState<ArchiveBusinessStatus>(status);
  const [nextDueAt, setNextDueAt] = useState(toDateInputValue(dueAt));
  const [nextExpiresAt, setNextExpiresAt] = useState(toDateInputValue(expiresAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const basePath = kind === "item" ? `/api/archive/items/${id}` : `/api/archive/folders/${id}`;

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      const statusChanged = nextStatus !== status;
      const datesChanged = nextDueAt !== toDateInputValue(dueAt) || nextExpiresAt !== toDateInputValue(expiresAt);

      if (statusChanged) {
        const res = await fetch(`${basePath}/status`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setError(data?.reason || "Failed to update status");
          return;
        }
      }

      if (datesChanged) {
        const res = await fetch(`${basePath}/dates`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dueAt: nextDueAt || null,
            expiresAt: nextExpiresAt || null,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setError(data?.reason || "Failed to update dates");
          return;
        }
      }

      onSaved({
        status: nextStatus,
        dueAt: nextDueAt ? new Date(nextDueAt).toISOString() : null,
        expiresAt: nextExpiresAt ? new Date(nextExpiresAt).toISOString() : null,
      });
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex min-w-0 items-center gap-4 rounded-xl border border-lineSecondary p-4">
        <span className="w-[100px] shrink-0 font-semibold text-textColorThird">{locale === "nb" ? "Navn" : "Name"}</span>
        <span className="min-w-0 grow text-textColorSecond">{name}</span>
      </div>

      {description && (
        <div className="flex min-w-0 items-start gap-4 rounded-xl border border-lineSecondary p-4">
          <span className="w-[100px] shrink-0 font-semibold text-textColorThird">{locale === "nb" ? "Beskrivelse" : "Description"}</span>
          <span className="min-w-0 grow whitespace-pre-wrap text-textColorSecond">{description}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160]">
          <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Status" : "Status"}</label>
          <select
            className="customInput w-full"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as ArchiveBusinessStatus)}
            disabled={saving}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[160]">
          <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Forfallsdato" : "Due date"}</label>
          <input
            type="date"
            className="customInput w-full"
            value={nextDueAt}
            onChange={(e) => setNextDueAt(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="min-w-[160]">
          <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Utløpsdato" : "Expiry date"}</label>
          <input
            type="date"
            className="customInput w-full"
            value={nextExpiresAt}
            onChange={(e) => setNextExpiresAt(e.target.value)}
            disabled={saving}
          />
        </div>

        <button type="button" className="customButtonEnabled h-10 px-6" onClick={() => void handleSave()} disabled={saving}>
          {saving ? (locale === "nb" ? "Lagrer..." : "Saving...") : locale === "nb" ? "Lagre" : "Save"}
        </button>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
