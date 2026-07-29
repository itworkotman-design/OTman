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
  code: string;
};

export const STATUS_ORDER: ArchiveBusinessStatus[] = ["active", "draft", "inactive", "archived"];
