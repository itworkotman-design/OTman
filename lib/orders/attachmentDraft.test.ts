import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_ATTACHMENT_DRAFT,
  applyAttachmentDraft,
  hasAttachmentChanges,
  stageAttachmentRemoval,
  stageAttachmentUpload,
  visibleAttachments,
} from "./attachmentDraft";
import type { AttachmentItem } from "./attachmentCategories";

const saved: AttachmentItem[] = [
  { id: "a1", category: "ATTACHMENT", filename: "kvittering.pdf", mimeType: "application/pdf", sizeBytes: 10, url: "/a1" },
  { id: "a2", category: "ATTACHMENT", filename: "bilde.jpg", mimeType: "image/jpeg", sizeBytes: 20, url: "/a2" },
];
const file = (name: string) => new File(["x"], name, { type: "application/pdf" });

describe("attachment draft — files only change on Save", () => {
  it("starts with no changes", () => {
    expect(hasAttachmentChanges(EMPTY_ATTACHMENT_DRAFT)).toBe(false);
    expect(visibleAttachments(saved, EMPTY_ATTACHMENT_DRAFT)).toEqual(saved);
  });

  it("shows a picked file first, without uploading it", () => {
    const draft = stageAttachmentUpload(EMPTY_ATTACHMENT_DRAFT, file("ny.pdf"), "ATTACHMENT", { id: "local-1", url: "blob:1" });
    expect(hasAttachmentChanges(draft)).toBe(true);
    expect(visibleAttachments(saved, draft).map((item) => item.id)).toEqual(["local-1", "a1", "a2"]);
    expect(visibleAttachments(saved, draft)[0]).toMatchObject({ filename: "ny.pdf", mimeType: "application/pdf", url: "blob:1" });
  });

  it("hides a removed saved file until Save deletes it", () => {
    const draft = stageAttachmentRemoval(EMPTY_ATTACHMENT_DRAFT, "a1");
    expect(draft.removedIds).toEqual(["a1"]);
    expect(visibleAttachments(saved, draft).map((item) => item.id)).toEqual(["a2"]);
  });

  it("just drops a picked file that's removed again — nothing to delete on the server", () => {
    const picked = stageAttachmentUpload(EMPTY_ATTACHMENT_DRAFT, file("ny.pdf"), "ATTACHMENT", { id: "local-1", url: "blob:1" });
    const draft = stageAttachmentRemoval(picked, "local-1");
    expect(draft).toEqual(EMPTY_ATTACHMENT_DRAFT);
    expect(hasAttachmentChanges(draft)).toBe(false);
  });

  it("on Save uploads the picked files and deletes the removed ones", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    let draft = stageAttachmentUpload(EMPTY_ATTACHMENT_DRAFT, file("ny.pdf"), "RECEIPT", { id: "local-1", url: "blob:1" });
    draft = stageAttachmentRemoval(draft, "a2");

    const result = await applyAttachmentDraft("order-1", draft, fetchMock);

    expect(result).toMatchObject({ ok: true, failed: 0, remaining: EMPTY_ATTACHMENT_DRAFT });
    const upload = fetchMock.mock.calls.find(([url]) => url === "/api/orders/order-1/attachments");
    expect(upload?.[1]).toMatchObject({ method: "POST", credentials: "include" });
    const body = upload?.[1].body as FormData;
    expect((body.get("file") as File).name).toBe("ny.pdf");
    expect(body.get("category")).toBe("RECEIPT");
    expect(fetchMock).toHaveBeenCalledWith("/api/orders/attachments/a2", { method: "DELETE", credentials: "include" });
  });

  it("reports how many file changes failed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false }) })
      .mockRejectedValueOnce(new Error("offline"));
    let draft = stageAttachmentUpload(EMPTY_ATTACHMENT_DRAFT, file("ny.pdf"), "ATTACHMENT", { id: "local-1", url: "blob:1" });
    draft = stageAttachmentRemoval(draft, "a1");
    expect(await applyAttachmentDraft("order-1", draft, fetchMock)).toMatchObject({ ok: false, failed: 2 });
  });

  it("keeps only the failed changes, so Save can retry them without repeating the rest", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const failing = url === "/api/orders/attachments/a2" || (init.body instanceof FormData && (init.body.get("file") as File).name === "b.pdf");
      return { ok: !failing, json: async () => ({ ok: !failing }) };
    });
    let draft = stageAttachmentUpload(EMPTY_ATTACHMENT_DRAFT, file("a.pdf"), "ATTACHMENT", { id: "local-a", url: "blob:a" });
    draft = stageAttachmentUpload(draft, file("b.pdf"), "ATTACHMENT", { id: "local-b", url: "blob:b" });
    draft = stageAttachmentRemoval(draft, "a1");
    draft = stageAttachmentRemoval(draft, "a2");

    const result = await applyAttachmentDraft("order-1", draft, fetchMock);

    expect(result.failed).toBe(2);
    expect(result.remaining.added.map((staged) => staged.item.id)).toEqual(["local-b"]);
    expect(result.remaining.removedIds).toEqual(["a2"]);
  });

  it("does nothing when there are no changes", async () => {
    const fetchMock = vi.fn();
    expect(await applyAttachmentDraft("order-1", EMPTY_ATTACHMENT_DRAFT, fetchMock)).toMatchObject({ ok: true, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
