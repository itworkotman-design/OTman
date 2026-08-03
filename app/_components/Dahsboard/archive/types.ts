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
export function formatLastModified(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}
