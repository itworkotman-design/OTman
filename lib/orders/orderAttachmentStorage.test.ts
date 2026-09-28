import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  class PutObjectCommand extends Command {}
  class CopyObjectCommand extends Command {}
  class DeleteObjectCommand extends Command {}
  class GetObjectCommand extends Command {}
  class S3Client {
    send = mocks.send;
  }
  return { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));

import {
  promoteTempAttachmentToOrders,
  tempKeyToOrderKey,
  uploadTempAttachmentBufferToS3,
} from "./orderAttachmentStorage";

function sentCommands() {
  return mocks.send.mock.calls.map(([command]) => ({
    name: (command as object).constructor.name,
    input: (command as { input: Record<string, unknown> }).input,
  }));
}

describe("tempKeyToOrderKey", () => {
  it("maps tmp/<rest> to orders/<rest>", () => {
    expect(tempKeyToOrderKey("tmp/quote-requests/abc/1-x-photo.jpg")).toBe("orders/quote-requests/abc/1-x-photo.jpg");
  });

  it("returns null for anything that isn't under tmp/", () => {
    expect(tempKeyToOrderKey("orders/quote-requests/abc/photo.jpg")).toBeNull();
    expect(tempKeyToOrderKey("tmpfoo/photo.jpg")).toBeNull();
    expect(tempKeyToOrderKey("tmp/")).toBeNull();
  });
});

describe("uploadTempAttachmentBufferToS3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET = "bucket";
    process.env.AWS_REGION = "eu-north-1";
    process.env.AWS_ACCESS_KEY_ID = "id";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    mocks.send.mockResolvedValue({});
  });

  it("stores under tmp/<scope>/ (not orders/) so the lifecycle rule can expire it", async () => {
    const result = await uploadTempAttachmentBufferToS3({
      bytes: Buffer.from([1, 2, 3]),
      scope: "quote-requests/tok",
      filename: "photo.jpg",
      contentType: "image/jpeg",
    });

    expect(result.key.startsWith("tmp/quote-requests/tok/")).toBe(true);
    expect(result.storagePath).toBe(`s3://${result.key}`);
    const [put] = sentCommands();
    expect(put.name).toBe("PutObjectCommand");
    expect(put.input.Key).toBe(result.key);
  });
});

describe("promoteTempAttachmentToOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_BUCKET = "bucket";
    process.env.AWS_REGION = "eu-north-1";
    process.env.AWS_ACCESS_KEY_ID = "id";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    mocks.send.mockResolvedValue({});
  });

  it("copies tmp/... to orders/... then deletes the tmp object, returning the new storage path", async () => {
    const newPath = await promoteTempAttachmentToOrders("s3://tmp/quote-requests/tok/1-x-photo.jpg");

    expect(newPath).toBe("s3://orders/quote-requests/tok/1-x-photo.jpg");
    const commands = sentCommands();
    expect(commands.map((c) => c.name)).toEqual(["CopyObjectCommand", "DeleteObjectCommand"]);
    expect(commands[0].input).toMatchObject({
      Bucket: "bucket",
      Key: "orders/quote-requests/tok/1-x-photo.jpg",
      CopySource: "bucket/tmp/quote-requests/tok/1-x-photo.jpg",
    });
    expect(commands[1].input).toMatchObject({ Bucket: "bucket", Key: "tmp/quote-requests/tok/1-x-photo.jpg" });
  });

  it("does not delete the tmp object if the copy fails (and rethrows)", async () => {
    mocks.send.mockRejectedValueOnce(new Error("copy failed"));

    await expect(promoteTempAttachmentToOrders("s3://tmp/quote-requests/tok/photo.jpg")).rejects.toThrow("copy failed");
    expect(sentCommands().map((c) => c.name)).toEqual(["CopyObjectCommand"]);
  });

  it("still succeeds if deleting the tmp object fails — the lifecycle rule mops it up", async () => {
    mocks.send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("delete failed"));

    await expect(promoteTempAttachmentToOrders("s3://tmp/quote-requests/tok/photo.jpg")).resolves.toBe(
      "s3://orders/quote-requests/tok/photo.jpg",
    );
  });

  it("refuses a path that isn't a tmp/ S3 object", async () => {
    await expect(promoteTempAttachmentToOrders("s3://orders/quote-requests/tok/photo.jpg")).rejects.toThrow();
    await expect(promoteTempAttachmentToOrders("/uploads/x.jpg")).rejects.toThrow();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
