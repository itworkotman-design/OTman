// lib/integrations/wordpress/mirrorGsmUpdateToWordpress.ts

type MirrorGsmUpdateParams = {
  legacyWordpressOrderId: number | null;
  orderId: string;
  status?: string | null;
  statusNotes?: string | null;
  driver?: string | null;
  secondDriver?: string | null;
  driverInfo?: string | null;
  licensePlate?: string | null;
  deviation?: string | null;
  feeExtraWork?: boolean | null;
  extraWorkMinutes?: number | null;
  feeAddToOrder?: boolean | null;
  rabatt?: string | null;
  leggTil?: string | null;
  subcontractorMinus?: string | null;
  subcontractorPlus?: string | null;
  completedAt?: Date | string | null;
  podAttachmentId?: string | null;
  gsmTaskId?: string | null;
  gsmDocumentId?: string | null;
  attachments?: MirrorGsmUpdateAttachment[];
};

type MirrorGsmUpdateAttachment = {
  id: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  category?: string | null;
  source?: string | null;
  gsmTaskId?: string | null;
  gsmDocumentId?: string | null;
};

function buildAppUrl(appBaseUrl: string, path: string) {
  return new URL(path, appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`).toString();
}

export async function mirrorGsmUpdateToWordpress(params: MirrorGsmUpdateParams) {
  if (!params.legacyWordpressOrderId) return;

  const baseUrl = process.env.WORDPRESS_BASE_URL;
  const secret = process.env.WORDPRESS_GSM_MIRROR_SECRET;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!baseUrl || !secret || !appBaseUrl) {
    console.warn("Skipping WP GSM mirror: missing env vars");
    return;
  }

  const attachments =
    params.attachments?.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType ?? null,
      sizeBytes: attachment.sizeBytes ?? null,
      category: attachment.category ?? null,
      source: attachment.source ?? null,
      gsmTaskId: attachment.gsmTaskId ?? null,
      gsmDocumentId: attachment.gsmDocumentId ?? null,
      downloadUrl: buildAppUrl(
        appBaseUrl,
        `/api/orders/${encodeURIComponent(params.orderId)}/attachments/${encodeURIComponent(attachment.id)}/download?download=1`,
      ),
    })) ?? [];
  const podAttachment =
    (params.podAttachmentId
      ? attachments.find((attachment) => attachment.id === params.podAttachmentId)
      : null) ??
    attachments.find((attachment) => attachment.source === "GSM") ??
    null;
  const podDownloadUrl =
    podAttachment?.downloadUrl ??
    (params.podAttachmentId
      ? buildAppUrl(
          appBaseUrl,
          `/api/orders/${encodeURIComponent(params.orderId)}/attachments/${encodeURIComponent(params.podAttachmentId)}/download?download=1`,
        )
      : null);

  const response = await fetch(`${baseUrl}/wp-json/otman/v1/power-order-gsm-mirror`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-otman-gsm-mirror-secret": secret,
    },
    body: JSON.stringify({
      legacyWordpressOrderId: params.legacyWordpressOrderId,
      status: params.status,
      statusNotes: params.statusNotes,
      driver: params.driver,
      secondDriver: params.secondDriver,
      driverInfo: params.driverInfo,
      licensePlate: params.licensePlate,
      deviation: params.deviation,
      feeExtraWork: params.feeExtraWork,
      extraWorkMinutes: params.extraWorkMinutes,
      feeAddToOrder: params.feeAddToOrder,
      rabatt: params.rabatt,
      leggTil: params.leggTil,
      subcontractorMinus: params.subcontractorMinus,
      subcontractorPlus: params.subcontractorPlus,
      completedAt: params.completedAt instanceof Date ? params.completedAt.toISOString() : params.completedAt,
      podDownloadUrl,
      gsmTaskId: params.gsmTaskId,
      gsmDocumentId: params.gsmDocumentId,
      attachments,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("WP GSM mirror failed", {
      status: response.status,
      body,
      legacyWordpressOrderId: params.legacyWordpressOrderId,
    });
  }
}
