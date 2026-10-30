import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gsmFetchMock: vi.fn(),
  downloadAttachmentFromS3Mock: vi.fn(),
  readFileMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/integrations/gsm/client", () => ({
  gsmFetch: mocks.gsmFetchMock,
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  isS3StoragePath: (storagePath: string) => storagePath.startsWith("s3://"),
  downloadAttachmentFromS3: mocks.downloadAttachmentFromS3Mock,
}));

vi.mock("fs/promises", () => ({
  readFile: mocks.readFileMock,
}));

import { sendReceiptsToGsmTask } from "./sendReceipts";

const receipt = {
  id: "att-1",
  filename: "receipt.pdf",
  mimeType: "application/pdf",
  storagePath: "s3://orders/order-1/receipt.pdf",
};

function mockUploadFlow() {
  mocks.gsmFetchMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/documents/?task=")) return [];
    if (path === "/file_uploads/") {
      return {
        id: "upload-1",
        url: "https://api.gsmtasks.com/file_uploads/upload-1/",
        s3_signature: {
          url: "https://gsmtasks.s3.amazonaws.com/",
          fields: { key: "uploads/upload-1/receipt.pdf", policy: "p", "x-amz-signature": "s" },
        },
      };
    }
    if (path === "/documents/") return { id: "doc-1" };
    throw new Error(`unexpected path ${path}`);
  });
}

describe("sendReceiptsToGsmTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetchMock);
    mocks.fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    mocks.downloadAttachmentFromS3Mock.mockResolvedValue({
      bytes: Buffer.from("pdf-bytes"),
      contentType: "application/pdf",
      sizeBytes: 9,
    });
  });

  it("uploads a receipt to S3 and attaches it to the task, visible to the worker only", async () => {
    mockUploadFlow();

    const result = await sendReceiptsToGsmTask({ gsmTaskId: "task-1", receipts: [receipt] });

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(mocks.gsmFetchMock).toHaveBeenCalledWith(
      "/file_uploads/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          file_name: "receipt.pdf",
          file_type: "application/pdf",
          source: "integration",
        }),
      }),
    );

    const [s3Url, s3Init] = mocks.fetchMock.mock.calls[0];
    expect(s3Url).toBe("https://gsmtasks.s3.amazonaws.com/");
    expect(s3Init.method).toBe("POST");
    const form = s3Init.body as FormData;
    expect(form.get("key")).toBe("uploads/upload-1/receipt.pdf");
    expect(form.get("x-amz-signature")).toBe("s");
    // S3 requires the file to be the last form field.
    expect([...form.keys()].at(-1)).toBe("file");

    const documentCall = mocks.gsmFetchMock.mock.calls.find(([path]) => path === "/documents/");
    expect(JSON.parse(documentCall?.[1].body)).toEqual({
      task: "https://api.gsmtasks.com/tasks/task-1/",
      file_upload: "https://api.gsmtasks.com/file_uploads/upload-1/",
      external_id: "receipt:att-1:task-1",
      description: "receipt.pdf",
      source: "integration",
      visible_to_worker: true,
      visible_to_client: false,
    });
  });

  it("skips receipts already attached to the task (resend)", async () => {
    mocks.gsmFetchMock.mockImplementation(async (path: string) => {
      if (path === "/documents/?task=task-1") {
        return [{ id: "doc-1", external_id: "receipt:att-1:task-1" }, { id: "photo", external_id: "x" }];
      }
      throw new Error(`unexpected path ${path}`);
    });

    const result = await sendReceiptsToGsmTask({ gsmTaskId: "task-1", receipts: [receipt] });

    expect(result).toEqual({ sent: 0, skipped: 1 });
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("reads locally stored receipts from the public uploads folder", async () => {
    mockUploadFlow();
    mocks.readFileMock.mockResolvedValue(Buffer.from("local-bytes"));

    await sendReceiptsToGsmTask({
      gsmTaskId: "task-1",
      receipts: [{ ...receipt, storagePath: "/uploads/orders/order-1/receipt.pdf" }],
    });

    expect(String(mocks.readFileMock.mock.calls[0][0]).replaceAll("\\", "/")).toMatch(
      /public\/uploads\/orders\/order-1\/receipt\.pdf$/,
    );
    expect(mocks.downloadAttachmentFromS3Mock).not.toHaveBeenCalled();
  });

  it("throws when the S3 upload fails, without creating the document", async () => {
    mockUploadFlow();
    mocks.fetchMock.mockResolvedValue(new Response("denied", { status: 403 }));

    await expect(
      sendReceiptsToGsmTask({ gsmTaskId: "task-1", receipts: [receipt] }),
    ).rejects.toThrow(/403/);
    expect(mocks.gsmFetchMock).not.toHaveBeenCalledWith("/documents/", expect.anything());
  });
});
