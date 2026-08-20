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
  sectionId: string | null;
  isPinned: boolean;
  ownerUserId: string;
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
  sectionId: string | null;
  ownerUserId: string;
  isPinned: boolean;
  viewerCount: number;
};

// Tenant-scoped tag identity (0.2.0 delivery) — see
// @customprojects/custom-archive's ArchiveTagSummary.
export type ArchiveTagSummary = {
  id: string;
  name: string;
};

// A section is a purely host-side grouping label within a folder's settings
// (or the archive root) — see lib/docArchive/sections.ts. folderCount/
// itemCount reflect how many subfolders/items currently reference it, used
// to gate deletion (a section can only be deleted while empty).
export type ArchiveSectionSummary = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  folderCount: number;
  itemCount: number;
};

// Sentinel used client-side only (never sent to the API as a real id) for
// the bucket of subfolders/items whose ArchiveFolderCode/ArchiveItemCode.
// sectionId is null — content created before sections existed. Distinct
// from any real cuid, so it can share the same "group by sectionId" map key
// space as actual sections.
export const UNGROUPED_SECTION_ID = "__ungrouped__";

export type ArchiveSectionGroup<T> = { id: string; name: string | null; entries: T[] };

// Shared by the read-only browsing views (FolderView, the archive root
// page) to group subfolders/items under their section's name — title only,
// no description there (the description is settings-page detail, not
// something a viewer browsing the tree needs). Section order follows the
// `sections` list itself; anything with no section (legacy content, or a
// scope that hasn't used sections yet) lands in one final "Ungrouped"
// group, or renders unlabeled if there are no real sections at all in this
// scope (so a company that never adopts sections sees the old flat list).
export function groupBySection<T extends { sectionId: string | null }>(
  entries: T[],
  sections: ArchiveSectionSummary[],
  locale: string,
): ArchiveSectionGroup<T>[] {
  const bySection = new Map<string, T[]>();
  for (const entry of entries) {
    const key = entry.sectionId ?? UNGROUPED_SECTION_ID;
    const list = bySection.get(key) ?? [];
    list.push(entry);
    bySection.set(key, list);
  }

  const groups: ArchiveSectionGroup<T>[] = [];
  for (const section of sections) {
    const sectionEntries = bySection.get(section.id) ?? [];
    if (sectionEntries.length > 0) groups.push({ id: section.id, name: section.name, entries: sectionEntries });
  }

  const ungrouped = bySection.get(UNGROUPED_SECTION_ID) ?? [];
  if (ungrouped.length > 0) {
    groups.push({
      id: UNGROUPED_SECTION_ID,
      name: sections.length > 0 ? (locale === "nb" ? "Ugruppert" : "Ungrouped") : null,
      entries: ungrouped,
    });
  }

  return groups;
}

export type ArchiveMixedSectionGroup<F, I> = { id: string; name: string | null; folders: F[]; items: I[] };

// Folder-view variant of groupBySection: a folder's own view page shows both
// its subfolders and its items under one shared per-section heading (a
// section can contain either, or both), rather than two independently
// section-grouped lists — so this groups both arrays together in one pass,
// keyed by the same section, with one combined "Ungrouped" group at the end
// instead of a separate ungrouped bucket per entity type.
export function groupMixedBySection<
  F extends { sectionId: string | null },
  I extends { sectionId: string | null },
>(folders: F[], items: I[], sections: ArchiveSectionSummary[], locale: string): ArchiveMixedSectionGroup<F, I>[] {
  const foldersBySection = new Map<string, F[]>();
  for (const folder of folders) {
    const key = folder.sectionId ?? UNGROUPED_SECTION_ID;
    const list = foldersBySection.get(key) ?? [];
    list.push(folder);
    foldersBySection.set(key, list);
  }

  const itemsBySection = new Map<string, I[]>();
  for (const item of items) {
    const key = item.sectionId ?? UNGROUPED_SECTION_ID;
    const list = itemsBySection.get(key) ?? [];
    list.push(item);
    itemsBySection.set(key, list);
  }

  const groups: ArchiveMixedSectionGroup<F, I>[] = [];
  for (const section of sections) {
    const sectionFolders = foldersBySection.get(section.id) ?? [];
    const sectionItems = itemsBySection.get(section.id) ?? [];
    if (sectionFolders.length > 0 || sectionItems.length > 0) {
      groups.push({ id: section.id, name: section.name, folders: sectionFolders, items: sectionItems });
    }
  }

  const ungroupedFolders = foldersBySection.get(UNGROUPED_SECTION_ID) ?? [];
  const ungroupedItems = itemsBySection.get(UNGROUPED_SECTION_ID) ?? [];
  if (ungroupedFolders.length > 0 || ungroupedItems.length > 0) {
    groups.push({
      id: UNGROUPED_SECTION_ID,
      name: sections.length > 0 ? (locale === "nb" ? "Ugruppert" : "Ungrouped") : null,
      folders: ungroupedFolders,
      items: ungroupedItems,
    });
  }

  return groups;
}

export const STATUS_ORDER: ArchiveBusinessStatus[] = ["active", "draft", "inactive", "archived"];

// Archive URLs are the entity's own display code with dots turned into
// slashes (e.g. code "1.2F.3F" -> path "1/2F/3F"), so every folder/item link
// in the UI is built from this rather than the entity's opaque id.
export function codeToUrlPath(code: string): string {
  return code.split(".").join("/");
}

// EntityPill's leading code badge is given a shared, fixed width
// (in `ch`) instead of shrink-wrapping to its own text — deeper folders have
// longer codes ("1.2F.3F" vs "1"), and even same-length codes render at
// very slightly different natural widths depending on which digits they
// contain, so an auto-sized badge drifts a couple pixels row to row. Sizing
// every badge in a list off the single longest code currently on screen
// keeps them all pixel-identical, and the width grows on its own as you
// navigate into deeper folders. +2 leaves room for the badge's own padding.
// `minCh` raises the floor for lists that would otherwise size to a
// single-digit root code (e.g. the archive root page's top-level folders,
// "1", "2", …) and end up looking too thin next to the rest of the row.
export function codeBadgeWidthCh(codes: string[], minCh = 0): number {
  const maxLen = codes.reduce((max, code) => Math.max(max, code.length), 1);
  return Math.max(maxLen + 2, minCh);
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

// Localized column labels for EntityPill's PillField "entries"/"users"/
// "updated" keys — shared by every list that builds a PillFieldsHeader (see
// EntityPill.tsx) to caption those columns, so the label text always matches
// whichever locale computed the row values themselves.
export function pillFieldLabel(key: "entries" | "users" | "updated", locale: string): string {
  switch (key) {
    case "entries":
      return locale === "nb" ? "Oppføringer" : "Entries";
    case "users":
      return locale === "nb" ? "Brukere" : "Users";
    case "updated":
      return locale === "nb" ? "Oppdatert" : "Updated";
  }
}

export function formatLastModified(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}
