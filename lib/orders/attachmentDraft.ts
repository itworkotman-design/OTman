import type { AttachmentCategory, AttachmentItem } from "./attachmentCategories";

// An existing order's attachment changes, held in the browser until the
// order's Save button — picking or removing a file never changes the order by
// itself. Used by the booking editor (BookingEditor) and the website order
// modal (WebsiteOrderAttachments). New orders keep using pending uploads
// (/api/orders/pending-attachments), linked when the order is created.

export type StagedAttachment = { item: AttachmentItem; file: File };

export type AttachmentDraft = {
  // Picked files, not uploaded yet (newest first).
  added: StagedAttachment[];
  // Saved attachments to delete on Save.
  removedIds: string[];
};

export const EMPTY_ATTACHMENT_DRAFT: AttachmentDraft = { added: [], removedIds: [] };

export function hasAttachmentChanges(draft: AttachmentDraft) {
  return draft.added.length > 0 || draft.removedIds.length > 0;
}

// `local` is the picked file's temporary id and preview URL (an object URL).
export function stageAttachmentUpload(
  draft: AttachmentDraft,
  file: File,
  category: AttachmentCategory,
  local: { id: string; url: string },
): AttachmentDraft {
  const item: AttachmentItem = {
    id: local.id,
    category,
    filename: file.name || "attachment",
    mimeType: file.type,
    sizeBytes: file.size,
    url: local.url,
  };
  return { ...draft, added: [{ item, file }, ...draft.added] };
}

// A picked file is simply dropped; a saved one is deleted on Save.
export function stageAttachmentRemoval(draft: AttachmentDraft, attachmentId: string): AttachmentDraft {
  if (draft.added.some((staged) => staged.item.id === attachmentId)) {
    return { ...draft, added: draft.added.filter((staged) => staged.item.id !== attachmentId) };
  }
  if (draft.removedIds.includes(attachmentId)) return draft;
  return { ...draft, removedIds: [...draft.removedIds, attachmentId] };
}

// What the order's attachments will be after Save.
export function visibleAttachments(saved: AttachmentItem[], draft: AttachmentDraft): AttachmentItem[] {
  return [...draft.added.map((staged) => staged.item), ...saved.filter((item) => !draft.removedIds.includes(item.id))];
}

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

// Run by the Save button, after the order itself saved: uploads the picked
// files and deletes the removed ones. `failed` counts the changes that didn't
// go through; `remaining` holds just those, so Save can retry them alone.
export async function applyAttachmentDraft(
  orderId: string,
  draft: AttachmentDraft,
  fetchImpl: FetchLike = fetch,
): Promise<{ ok: boolean; failed: number; remaining: AttachmentDraft }> {
  const succeeded = async (request: Promise<{ ok: boolean; json: () => Promise<unknown> }>) => {
    try {
      const res = await request;
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      return res.ok && data?.ok === true;
    } catch {
      return false;
    }
  };

  const [uploaded, deleted] = await Promise.all([
    Promise.all(
      draft.added.map(({ item, file }) => {
        const body = new FormData();
        body.append("file", file);
        body.append("category", item.category);
        return succeeded(fetchImpl(`/api/orders/${orderId}/attachments`, { method: "POST", body, credentials: "include" }));
      }),
    ),
    Promise.all(
      draft.removedIds.map((attachmentId) =>
        succeeded(fetchImpl(`/api/orders/attachments/${attachmentId}`, { method: "DELETE", credentials: "include" })),
      ),
    ),
  ]);
  const remaining: AttachmentDraft = {
    added: draft.added.filter((_, index) => !uploaded[index]),
    removedIds: draft.removedIds.filter((_, index) => !deleted[index]),
  };
  const failed = remaining.added.length + remaining.removedIds.length;
  return { ok: failed === 0, failed, remaining };
}
