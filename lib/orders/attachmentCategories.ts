export const ATTACHMENT_CATEGORIES = ["RECEIPT", "ATTACHMENT"] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export type AttachmentItem = {
  id: string;
  category: AttachmentCategory;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

export function isAttachmentCategory(
  value: string,
): value is AttachmentCategory {
  return ATTACHMENT_CATEGORIES.includes(value as AttachmentCategory);
}

export function normalizeAttachmentCategory(
  value: FormDataEntryValue | string | null | undefined,
): AttachmentCategory {
  if (typeof value !== "string") {
    return "ATTACHMENT";
  }

  return isAttachmentCategory(value) ? value : "ATTACHMENT";
}

export function getAttachmentCategoryLabel(category: AttachmentCategory) {
  return category === "RECEIPT" ? "Receipt" : "Attachment";
}
