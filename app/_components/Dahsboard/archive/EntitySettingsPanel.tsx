"use client";

import { useState } from "react";
import type { ArchiveBusinessStatus } from "./types";

type EntitySettingsPanelProps = {
  kind: "item" | "folder";
  id: string;
  name: string;
  description: string | null;
  status: ArchiveBusinessStatus;
  locale: string;
  onSaved: () => void;
};

const STATUS_OPTIONS: ArchiveBusinessStatus[] = ["active", "draft", "inactive", "archived"];

// The backend has no rename/edit capability for name/description (a known,
// previously-documented gap in @customprojects/custom-archive — no such
// method exists) — those fields are shown read-only.
//
// Due date and expiry date both live in the "Reminders" section
// (ReminderSettingsPanel) now, as its two tabs — per explicit user
// feedback, having either date live here next to Status was confusing since
// neither is a "status" concept and both are really reminder concepts (a
// recurring due-date reminder vs. a one-time expiry reminder).
export function EntitySettingsPanel({ kind, id, name, description, status, locale, onSaved }: EntitySettingsPanelProps) {
  const [nextStatus, setNextStatus] = useState<ArchiveBusinessStatus>(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const basePath = kind === "item" ? `/api/archive/items/${id}` : `/api/archive/folders/${id}`;

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

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

      onSaved();
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

      <div className="min-w-[160]">
        <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Status" : "Status"}</label>
        <select
          className="customInput w-full max-w-[240]"
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

      <div>
        <button type="button" className="customButtonEnabled h-10 px-6" onClick={() => void handleSave()} disabled={saving}>
          {saving ? (locale === "nb" ? "Lagrer..." : "Saving...") : locale === "nb" ? "Lagre" : "Save"}
        </button>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
