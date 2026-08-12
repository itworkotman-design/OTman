"use client";

import { useMemo, useState } from "react";
import type { RecurrenceType } from "@prisma/client";
import { ReminderRecurrencePicker, type ReminderRecurrenceConfigDraft } from "./ReminderRecurrencePicker";
import { findNextRecurrenceDate, isRecurrenceConfigValid } from "@/lib/orders/recurringOrders/occurrenceDates";
import { getOsloDateKey } from "@/lib/dates/isoDate";

type ReminderSettingsPanelProps = {
  kind: "item" | "folder";
  id: string;
  dueAt: string | null;
  expiresAt: string | null;
  reminderDescription: string | null;
  reminderRecurrenceType: RecurrenceType | null;
  reminderRecurrenceConfig: unknown | null;
  locale: string;
  onSaved: () => void;
};

type Tab = "recurrence" | "expiry";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Reads either shape `reminderRecurrenceConfig` may already hold — a single
// legacy number, or an array (up to MAX_MONTHLY_DAYS, enforced by the
// picker, not here) — into the picker's always-array draft shape.
function normalizeMonthlyDraftDays(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) {
    const days = value.filter((d): d is number => typeof d === "number");
    if (days.length > 0) return days;
  }
  return [1];
}

function toRecurrenceDraft(type: RecurrenceType | null, config: unknown): ReminderRecurrenceConfigDraft {
  const candidate = (config ?? {}) as Record<string, unknown>;

  return {
    weekdays: type === "WEEKLY" && Array.isArray(candidate.weekdays) ? (candidate.weekdays as number[]) : [],
    dayOfMonth: type === "MONTHLY" ? normalizeMonthlyDraftDays(candidate.dayOfMonth) : [1],
    dates: type === "CUSTOM_DATES" && Array.isArray(candidate.dates) ? (candidate.dates as string[]) : [],
  };
}

function toStoredRecurrenceConfig(type: RecurrenceType, draft: ReminderRecurrenceConfigDraft): unknown {
  if (type === "WEEKLY") return { weekdays: draft.weekdays };
  if (type === "MONTHLY") return { dayOfMonth: draft.dayOfMonth };
  return { dates: draft.dates };
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${active ? "bg-green-500" : "bg-textColorThird/40"}`}
      aria-hidden
    />
  );
}

// Everything reminder-shaped lives in this one section, split into two tabs
// per explicit user request: "Recurrence" (the due date +
// description-override + recurrence rule that drives the Reminders widget on
// the admin dashboard (RemindersSection), and that
// lib/docArchive/reminderRecurrence.ts advances) and "Expiry" (just the
// expiry date that drives that same widget's Expiring rows). They're kept as
// separate tabs with independent Save actions rather than one merged form —
// they're unrelated fields with unrelated semantics (a recurring due date vs.
// a one-time expiry date), and merging them back into one form is exactly
// the "what does this field actually do" confusion this whole split was
// meant to fix. Each tab also shows a live active/off status dot (so it's
// visible without saving first) and its own "Clear" action, per explicit
// user request to make it obvious at a glance whether a reminder or expiry
// is currently enabled for this folder/item, and to disable one without
// having to fiddle with the date input/picker.
export function ReminderSettingsPanel({
  kind,
  id,
  dueAt,
  expiresAt,
  reminderDescription,
  reminderRecurrenceType,
  reminderRecurrenceConfig,
  locale,
  onSaved,
}: ReminderSettingsPanelProps) {
  const [tab, setTab] = useState<Tab>("recurrence");

  const [nextDueAt, setNextDueAt] = useState(toDateInputValue(dueAt));
  const [nextDescription, setNextDescription] = useState(reminderDescription ?? "");
  const [nextRecurrenceType, setNextRecurrenceType] = useState<RecurrenceType | null>(reminderRecurrenceType);
  const [nextRecurrenceConfig, setNextRecurrenceConfig] = useState<ReminderRecurrenceConfigDraft>(
    toRecurrenceDraft(reminderRecurrenceType, reminderRecurrenceConfig),
  );

  const [nextExpiresAt, setNextExpiresAt] = useState(toDateInputValue(expiresAt));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const basePath = kind === "item" ? `/api/archive/items/${id}` : `/api/archive/folders/${id}`;

  // Weekly/Monthly/Custom dates no longer take a separately-entered due
  // date at all — the due date IS the next date the chosen pattern matches,
  // derived here and re-derived live as the picker's selection changes.
  // Only "Once" (recurrenceType === null) still uses the manually-entered
  // `nextDueAt`, since there's no pattern to derive it from.
  const storedRecurrenceConfig = useMemo(
    () => (nextRecurrenceType ? toStoredRecurrenceConfig(nextRecurrenceType, nextRecurrenceConfig) : null),
    [nextRecurrenceType, nextRecurrenceConfig],
  );
  const computedRecurrenceDueDate = useMemo(
    () => (nextRecurrenceType ? findNextRecurrenceDate(nextRecurrenceType, storedRecurrenceConfig, getOsloDateKey()) : null),
    [nextRecurrenceType, storedRecurrenceConfig],
  );

  // Whether this folder/item is actually a "live" reminder is driven by the
  // effective due date, not recurrenceType — "Once" is a legitimate, active
  // reminder state that just happens to always store recurrenceType as
  // null. Using recurrenceType here would make "Once" show "Not set"
  // forever even with a real due date saved, which is exactly the
  // "pressing Once does nothing" bug this was fixed for.
  const reminderActive = nextRecurrenceType ? computedRecurrenceDueDate !== null : nextDueAt !== "";
  const canClearRecurrence = nextRecurrenceType !== null;
  const expiryActive = nextExpiresAt !== "";

  // Save only shows once something in its own tab actually differs from
  // what's persisted — Clear/StatusDot stay visible regardless, since those
  // reflect current saved state rather than a pending edit.
  const recurrenceDirty =
    nextRecurrenceType !== reminderRecurrenceType ||
    nextDescription !== (reminderDescription ?? "") ||
    nextDueAt !== toDateInputValue(dueAt) ||
    JSON.stringify(nextRecurrenceConfig) !== JSON.stringify(toRecurrenceDraft(reminderRecurrenceType, reminderRecurrenceConfig));
  const expiryDirty = nextExpiresAt !== toDateInputValue(expiresAt);

  async function saveRecurrence(recurrenceType: RecurrenceType | null, recurrenceConfig: unknown | null) {
    const res = await fetch(`${basePath}/reminder-settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: nextDescription.trim() || null,
        recurrenceType,
        recurrenceConfig,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.reason || "Failed to update reminder settings");
    }
  }

  async function saveDueAt(value: string | null) {
    const res = await fetch(`${basePath}/dates`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueAt: value }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.reason || "Failed to update due date");
    }
  }

  async function saveExpiresAt(value: string | null) {
    const res = await fetch(`${basePath}/dates`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresAt: value }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.reason || "Failed to update expiry date");
    }
  }

  async function handleSaveRecurrence() {
    try {
      setSaving(true);
      setError("");

      if (nextRecurrenceType && !isRecurrenceConfigValid(nextRecurrenceType, storedRecurrenceConfig)) {
        setError(
          locale === "nb"
            ? "Velg minst én ukedag eller dato for gjentakelsen"
            : "Select at least one weekday or date for the recurrence",
        );
        return;
      }

      const effectiveDueDate = nextRecurrenceType ? computedRecurrenceDueDate : nextDueAt || null;

      if (nextRecurrenceType && !effectiveDueDate) {
        setError(
          locale === "nb"
            ? "Fant ingen kommende dato som passer gjentakelsen"
            : "Couldn't find an upcoming date matching this recurrence",
        );
        return;
      }

      if (effectiveDueDate !== toDateInputValue(dueAt)) {
        await saveDueAt(effectiveDueDate ? new Date(effectiveDueDate).toISOString() : null);
      }

      await saveRecurrence(nextRecurrenceType, storedRecurrenceConfig);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save reminder settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearRecurrence() {
    try {
      setSaving(true);
      setError("");
      await saveRecurrence(null, null);
      setNextRecurrenceType(null);
      setNextRecurrenceConfig({ weekdays: [], dayOfMonth: [1], dates: [] });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear recurrence");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearDueDate() {
    try {
      setSaving(true);
      setError("");
      await saveDueAt(null);
      setNextDueAt("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear due date");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveExpiry() {
    try {
      setSaving(true);
      setError("");
      await saveExpiresAt(nextExpiresAt ? new Date(nextExpiresAt).toISOString() : null);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save expiry date");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearExpiry() {
    try {
      setSaving(true);
      setError("");
      await saveExpiresAt(null);
      setNextExpiresAt("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear expiry date");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("recurrence")}
          className={`customButtonDefault flex items-center gap-2 ${tab === "recurrence" ? "customButtonEnabled" : ""}`}
        >
          <StatusDot active={reminderActive} />
          {locale === "nb" ? "Gjentakelse" : "Recurrence"}
        </button>
        <button
          type="button"
          onClick={() => setTab("expiry")}
          className={`customButtonDefault flex items-center gap-2 ${tab === "expiry" ? "customButtonEnabled" : ""}`}
        >
          <StatusDot active={expiryActive} />
          {locale === "nb" ? "Utløp" : "Expiry"}
        </button>
      </div>

      {tab === "recurrence" ? (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-textColorSecond">
              <StatusDot active={reminderActive} />
              {reminderActive
                ? locale === "nb" ? "Aktiv" : "Active"
                : locale === "nb" ? "Ikke satt" : "Not set"}
            </p>
            <div className="flex gap-4">
              {canClearRecurrence && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-600 hover:underline"
                  onClick={() => void handleClearRecurrence()}
                  disabled={saving}
                >
                  {locale === "nb" ? "Fjern gjentakelse" : "Clear recurrence"}
                </button>
              )}
              {!nextRecurrenceType && reminderActive && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-600 hover:underline"
                  onClick={() => void handleClearDueDate()}
                  disabled={saving}
                >
                  {locale === "nb" ? "Fjern forfallsdato" : "Clear due date"}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-textColorThird">
            {locale === "nb"
              ? "Forfallsdatoen (og gjentakelsen under) styrer om dette vises under \"Reminders\" på admin-dashbordet."
              : "The due date (and the recurrence below) controls whether this shows up under \"Reminders\" on the admin dashboard."}
          </p>

          <ReminderRecurrencePicker
            dueAt={nextDueAt}
            onDueAtChange={setNextDueAt}
            computedNextOccurrence={computedRecurrenceDueDate}
            description={nextDescription}
            onDescriptionChange={setNextDescription}
            recurrenceType={nextRecurrenceType}
            onRecurrenceTypeChange={setNextRecurrenceType}
            recurrenceConfig={nextRecurrenceConfig}
            onRecurrenceConfigChange={setNextRecurrenceConfig}
            locale={locale}
            disabled={saving}
          />

          {recurrenceDirty && (
            <div>
              <button
                type="button"
                className="customButtonEnabled h-10 px-6"
                onClick={() => void handleSaveRecurrence()}
                disabled={saving}
              >
                {saving ? (locale === "nb" ? "Lagrer..." : "Saving...") : locale === "nb" ? "Lagre" : "Save"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-textColorSecond">
              <StatusDot active={expiryActive} />
              {expiryActive
                ? locale === "nb" ? "Aktiv" : "Active"
                : locale === "nb" ? "Ikke satt" : "Not set"}
            </p>
            {expiryActive && (
              <button
                type="button"
                className="text-sm font-medium text-red-600 hover:underline"
                onClick={() => void handleClearExpiry()}
                disabled={saving}
              >
                {locale === "nb" ? "Fjern utløpsdato" : "Clear expiry date"}
              </button>
            )}
          </div>

          <p className="text-xs text-textColorThird">
            {locale === "nb"
              ? "Denne utløpsdatoen styrer om dette vises under \"Expiring\" på admin-dashbordet. Den gjentar seg ikke."
              : "This expiry date controls whether this shows up under \"Expiring\" on the admin dashboard. It does not repeat."}
          </p>

          <div className="min-w-[160]">
            <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Utløpsdato" : "Expiry date"}</label>
            <input
              type="date"
              className="customInput w-full max-w-[240]"
              value={nextExpiresAt}
              onChange={(e) => setNextExpiresAt(e.target.value)}
              disabled={saving}
            />
          </div>

          {expiryDirty && (
            <div>
              <button
                type="button"
                className="customButtonEnabled h-10 px-6"
                onClick={() => void handleSaveExpiry()}
                disabled={saving}
              >
                {saving ? (locale === "nb" ? "Lagrer..." : "Saving...") : locale === "nb" ? "Lagre" : "Save"}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
