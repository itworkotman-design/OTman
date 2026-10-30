// path: lib/integrations/gsm/sendReceipts.ts
import { readFile } from "fs/promises";
import path from "path";
import { gsmFetch } from "@/lib/integrations/gsm/client";
import {
  downloadAttachmentFromS3,
  isS3StoragePath,
} from "@/lib/orders/orderAttachmentStorage";

const GSM_API_BASE = process.env.GSM_API_BASE ?? "https://api.gsmtasks.com";

export type GsmReceipt = {
  id: string;
  filename: string;
  mimeType: string | null;
  storagePath: string;
};

type GsmDocument = {
  id?: string;
  external_id?: string | null;
};

type GsmFileUpload = {
  url?: string;
  s3_signature?: {
    url?: string;
    fields?: Record<string, string>;
  };
};

// Only RECEIPT attachments are ever pushed. ATTACHMENT rows include the POD
// pulled back from GSM, so pushing those would feed GSM its own files.
// GSM treats external_id as unique per account (a repeat POST updates the
// existing document), so the task id must be part of it.
function receiptExternalId(receiptId: string, gsmTaskId: string) {
  return `receipt:${receiptId}:${gsmTaskId}`;
}

async function readReceiptBytes(receipt: GsmReceipt) {
  if (isS3StoragePath(receipt.storagePath)) {
    const file = await downloadAttachmentFromS3(receipt.storagePath);

    if (!file) {
      throw new Error(`Receipt ${receipt.id} could not be read from S3`);
    }

    return file.bytes;
  }

  if (receipt.storagePath.startsWith("/uploads/")) {
    return readFile(path.join(process.cwd(), "public", receipt.storagePath));
  }

  throw new Error(`Receipt ${receipt.id} has no readable file`);
}

async function uploadReceipt(gsmTaskId: string, receipt: GsmReceipt) {
  const bytes = await readReceiptBytes(receipt);

  const upload = await gsmFetch<GsmFileUpload>("/file_uploads/", {
    method: "POST",
    body: JSON.stringify({
      file_name: receipt.filename,
      file_type: receipt.mimeType ?? "application/octet-stream",
      source: "integration",
    }),
  });

  const signature = upload.s3_signature;

  if (!upload.url || !signature?.url || !signature.fields) {
    throw new Error("GSM file upload response missing S3 signature");
  }

  // S3 presigned POST: policy fields first, the file must be the last field.
  const form = new FormData();
  for (const [key, value] of Object.entries(signature.fields)) {
    form.append(key, value);
  }
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: receipt.mimeType ?? "application/octet-stream" }),
    receipt.filename,
  );

  const s3Res = await fetch(signature.url, { method: "POST", body: form });

  if (!s3Res.ok) {
    throw new Error(`S3 upload failed (${s3Res.status})`);
  }

  await gsmFetch("/documents/", {
    method: "POST",
    body: JSON.stringify({
      task: `${GSM_API_BASE}/tasks/${gsmTaskId}/`,
      file_upload: upload.url,
      external_id: receiptExternalId(receipt.id, gsmTaskId),
      description: receipt.filename,
      source: "integration",
      visible_to_worker: true,
      visible_to_client: false,
    }),
  });
}

export async function sendReceiptsToGsmTask(params: {
  gsmTaskId: string;
  receipts: GsmReceipt[];
}) {
  const { gsmTaskId, receipts } = params;

  const existing = await gsmFetch<GsmDocument[]>(
    `/documents/?task=${encodeURIComponent(gsmTaskId)}`,
    { method: "GET" },
  );
  const existingExternalIds = new Set(
    (Array.isArray(existing) ? existing : []).map((doc) => doc.external_id),
  );

  let sent = 0;
  let skipped = 0;

  for (const receipt of receipts) {
    if (existingExternalIds.has(receiptExternalId(receipt.id, gsmTaskId))) {
      skipped += 1;
      continue;
    }

    await uploadReceipt(gsmTaskId, receipt);
    sent += 1;
  }

  return { sent, skipped };
}
