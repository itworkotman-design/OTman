export type ArchiveBusinessStatus = "active" | "inactive" | "draft" | "archived";

export type ArchiveConditionFlags = {
  isDueSoon: boolean;
  isOverdue: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
};

export type ArchiveFolderSummary = ArchiveConditionFlags & {
  id: string;
  name: string;
  description: string | null;
  status: ArchiveBusinessStatus;
  dueAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  entryCount: number;
  viewerCount: number;
  code: string;
};

export type ArchiveItemSummary = ArchiveConditionFlags & {
  id: string;
  folderId: string;
  name: string;
  description: string | null;
  status: ArchiveBusinessStatus;
  dueAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  code: string;
};

export const STATUS_ORDER: ArchiveBusinessStatus[] = ["active", "draft", "inactive", "archived"];

// Archive URLs are the entity's own display code with dots turned into
// slashes (e.g. code "1.2F.3F" -> path "1/2F/3F"), so every folder/item link
// in the UI is built from this rather than the entity's opaque id.
export function codeToUrlPath(code: string): string {
  return code.split(".").join("/");
}

// Matches the otman-archive prototype's SectionPill "lastModified" column
// format (dot-separated, 2-digit year, e.g. "29.07.26") rather than a
// locale-dependent Intl format — this is a fixed display convention, not a
// translated string.
// Shared by FolderSettingsView/ItemSettingsView's "Reminders" accordion row
// subtitle, so reminder/expiry status is visible without opening the
// dropdown at all. Whether the reminder half is "on" is driven by dueAt, not
// recurrenceType — "Once" (no repeat) always has recurrenceType === null but
// is still a real, active reminder as long as a due date is set; checking
// recurrenceType here would make a one-time reminder show no subtitle at
// all, same bug as ReminderSettingsPanel's status dot.
export function formatReminderSubtitle(
  dueAt: string | null,
  recurrenceType: string | null,
  expiresAt: string | null,
  locale: string,
): string | undefined {
  const parts: string[] = [];
  if (dueAt) parts.push(recurrenceType ? (locale === "nb" ? "Gjentar" : "Repeats") : (locale === "nb" ? "Forfaller" : "Due"));
  if (expiresAt) parts.push(locale === "nb" ? "Utløper" : "Expires");
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function formatLastModified(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}
