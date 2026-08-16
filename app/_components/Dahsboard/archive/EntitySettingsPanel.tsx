"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { TagsPanel } from "./TagsPanel";
import type { ArchiveBusinessStatus } from "./types";

type EntitySettingsPanelProps = {
  kind: "item" | "folder";
  id: string;
  name: string;
  description: string | null;
  status: ArchiveBusinessStatus;
  ownerUserId: string;
  locale: string;
  onSaved: () => void;
};

type OwnerOption = { userId: string; label: string };

const STATUS_OPTIONS: ArchiveBusinessStatus[] = ["active", "draft", "inactive", "archived"];

// Rename landed in the 0.2.0 package delivery (renameFolder/renameItem —
// see custom-archive-backend-feedback.md #2, now resolved upstream), so
// Name is real and persists via PATCH .../name. Description still has no
// backend field anywhere in the package's rename/create surface, so it
// stays local-only/decorative — typed description is never sent and resets
// on reload.
//
// Owner (setFolderOwner/setItemOwner, also 0.2.0) is real too. The option
// list is self + /api/archive/coworkers (same ARCHIVE_VIEW-filtered roster
// the folder-sharing picker uses) — if the current owner isn't in that set
// (e.g. their access was revoked since being made owner), it's resolved via
// /api/archive/coworkers/resolve and injected as an extra option so the
// select never silently shows nothing for a real value.
//
// Tags (also 0.2.0) render below via TagsPanel — a self-contained
// immediate-save panel, not part of this component's own dirty/Save flow.
//
// Due date and expiry date both live in the "Reminders" section
// (ReminderSettingsPanel) now, as its two tabs — per explicit user
// feedback, having either date live here next to Status was confusing since
// neither is a "status" concept and both are really reminder concepts (a
// recurring due-date reminder vs. a one-time expiry reminder).
export function EntitySettingsPanel({ kind, id, name, description, status, ownerUserId, locale, onSaved }: EntitySettingsPanelProps) {
  const currentUser = useCurrentUser();
  const [nextName, setNextName] = useState(name);
  const [nextDescription, setNextDescription] = useState(description ?? "");
  const [nextStatus, setNextStatus] = useState<ArchiveBusinessStatus>(status);
  const [nextOwnerUserId, setNextOwnerUserId] = useState(ownerUserId);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const basePath = kind === "item" ? `/api/archive/items/${id}` : `/api/archive/folders/${id}`;

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    async function loadOwnerOptions() {
      const options: OwnerOption[] = [
        { userId: currentUser!.id, label: locale === "nb" ? `${currentUser!.email} (deg)` : `${currentUser!.email} (you)` },
      ];

      const coworkersRes = await fetch("/api/archive/coworkers", { credentials: "include", cache: "no-store" });
      const coworkersData = await coworkersRes.json().catch(() => null);
      if (coworkersRes.ok && coworkersData?.ok) {
        for (const coworker of coworkersData.coworkers ?? []) {
          options.push({ userId: coworker.userId, label: coworker.username || coworker.email });
        }
      }

      if (!options.some((o) => o.userId === ownerUserId)) {
        const resolveRes = await fetch("/api/archive/coworkers/resolve", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: [ownerUserId] }),
        });
        const resolveData = await resolveRes.json().catch(() => null);
        const resolved = resolveData?.ok ? resolveData.users?.[0] : null;
        options.unshift({
          userId: ownerUserId,
          label: resolved ? resolved.username || resolved.email : ownerUserId,
        });
      }

      if (!cancelled) setOwnerOptions(options);
    }

    void loadOwnerOptions();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, ownerUserId]);

  const trimmedName = nextName.trim();
  const nameDirty = trimmedName.length > 0 && trimmedName !== name;
  const ownerDirty = nextOwnerUserId !== ownerUserId;
  const dirty = nextStatus !== status || nameDirty || ownerDirty;

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      if (nameDirty) {
        const nameRes = await fetch(`${basePath}/name`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName }),
        });
        const nameData = await nameRes.json().catch(() => null);
        if (!nameRes.ok || !nameData?.ok) {
          setError(nameData?.reason || "Failed to update name");
          return;
        }
      }

      if (nextStatus !== status) {
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

      if (ownerDirty) {
        const ownerRes = await fetch(`${basePath}/owner`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerUserId: nextOwnerUserId }),
        });
        const ownerData = await ownerRes.json().catch(() => null);
        if (!ownerRes.ok || !ownerData?.ok) {
          setError(ownerData?.reason || "Failed to update owner");
          return;
        }
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
      <div className="min-w-[240]">
        <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Navn" : "Name"}</label>
        <input
          className="customInput w-full max-w-[320]"
          type="text"
          value={nextName}
          onChange={(e) => setNextName(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="min-w-[240]">
        <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Beskrivelse" : "Description"}</label>
        <textarea
          className="customInput w-full max-w-[480]"
          rows={3}
          value={nextDescription}
          onChange={(e) => setNextDescription(e.target.value)}
          disabled={saving}
        />
      </div>

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

      <div className="min-w-[240]">
        <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Eier" : "Owner"}</label>
        <select
          className="customInput w-full max-w-[320]"
          value={nextOwnerUserId}
          onChange={(e) => setNextOwnerUserId(e.target.value)}
          disabled={saving || ownerOptions.length === 0}
        >
          {ownerOptions.map((option) => (
            <option key={option.userId} value={option.userId}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {dirty && (
        <div>
          <button type="button" className="customButtonEnabled h-10 px-6" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (locale === "nb" ? "Lagrer..." : "Saving...") : locale === "nb" ? "Lagre" : "Save"}
          </button>
        </div>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="min-w-[240]">
        <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Stikkord" : "Tags"}</label>
        <TagsPanel kind={kind} id={id} locale={locale} />
      </div>
    </div>
  );
}
