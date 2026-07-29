import Busboy from "busboy";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

export class UploadTooLargeError extends Error {}

export type StreamedUploadFile = {
  fieldname: string;
  filename: string;
  mimeType: string;
  size: number;
  readContent: () => Promise<Uint8Array>;
};

export type StreamedUpload = {
  fields: Record<string, string>;
  file: StreamedUploadFile | null;
  cleanup: () => Promise<void>;
};

// `req.formData()` parses the entire multipart body into memory before it
// resolves, so a large upload sits fully buffered in the Node heap for the
// whole network receive phase (which, for a 500MB file on a slow
// connection, can be minutes). This streams the incoming file part straight
// to a temp file on disk instead, keeping memory flat during receive. The
// archive package's `uploadFile` (see lib/docArchive/client.ts) only accepts
// one complete in-memory Uint8Array, so a single full-size read still has to
// happen eventually — but only briefly, right before the S3 write, via
// `readContent()`, instead of being held for the whole request lifetime.
export async function receiveMultipartUpload(
  req: Request,
  maxFileSizeBytes: number,
): Promise<StreamedUpload> {
  const contentType = req.headers.get("content-type");
  if (!contentType || !req.body) {
    throw new Error("Request is missing a multipart/form-data body");
  }

  const dir = await mkdtemp(join(tmpdir(), "archive-upload-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });

  const fields: Record<string, string> = {};
  let file: StreamedUploadFile | null = null;
  let tooLarge = false;
  let pendingFileWrite: Promise<void> = Promise.resolve();

  try {
    await new Promise<void>((resolve, reject) => {
      const busboy = Busboy({
        headers: { "content-type": contentType },
        limits: { fileSize: maxFileSizeBytes, files: 1 },
      });

      busboy.on("field", (name, value) => {
        fields[name] = value;
      });

      busboy.on("file", (fieldname, fileStream, info) => {
        const tempFilePath = join(dir, randomUUID());
        const writeStream = createWriteStream(tempFilePath);
        let size = 0;

        fileStream.on("data", (chunk: Buffer) => {
          size += chunk.length;
        });
        fileStream.on("limit", () => {
          tooLarge = true;
        });

        pendingFileWrite = new Promise<void>((res, rej) => {
          writeStream.on("finish", () => {
            file = {
              fieldname,
              filename: info.filename,
              mimeType: info.mimeType,
              size,
              readContent: async () => new Uint8Array(await readFile(tempFilePath)),
            };
            res();
          });
          writeStream.on("error", rej);
        });

        fileStream.pipe(writeStream);
      });

      busboy.on("error", reject);
      busboy.on("close", resolve);

      Readable.fromWeb(req.body as unknown as NodeWebReadableStream).pipe(busboy);
    });

    await pendingFileWrite;
  } catch (error) {
    await cleanup();
    throw error;
  }

  if (tooLarge) {
    await cleanup();
    throw new UploadTooLargeError("Uploaded file exceeds the maximum allowed size");
  }

  return { fields, file, cleanup };
}
