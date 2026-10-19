"use client";

import { useEffect, useState } from "react";
import OrderAttachmentsSection from "@/app/_components/Dahsboard/booking/create/OrderAttachmentsSection";
import type { AttachmentCategory, AttachmentItem } from "@/lib/orders/attachmentCategories";
import {
  hasAttachmentChanges,
  stageAttachmentRemoval,
  stageAttachmentUpload,
  visibleAttachments,
  type AttachmentDraft,
} from "@/lib/orders/attachmentDraft";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  orderId: string;
  locale: BookingUiLocale;
  // The unsaved file changes — held by the modal, applied by its Save.
  draft: AttachmentDraft;
  onDraftChange: (draft: AttachmentDraft) => void;
};

const MAX_ATTACHMENTS = 10;

// Attachments of a website order (no receipts — those are for the regular
// booking flow), straight in WebsiteOrderModal — the same section the regular
// order editor uses. Picking or removing a file changes nothing yet: the
// changes are an AttachmentDraft that the modal's Save uploads/deletes
// (applyAttachmentDraft), like every other change to the order.
export default function WebsiteOrderAttachments({ orderId, locale, draft, onDraftChange }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [saved, setSaved] = useState<AttachmentItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${orderId}/attachments`, { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok) setSaved(data.attachments ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const shown = visibleAttachments(saved, draft);

  function pick(file: File, category: AttachmentCategory) {
    if (shown.length >= MAX_ATTACHMENTS) {
      setError(t("Max 10 attachments allowed", "Maks 10 vedlegg"));
      return;
    }
    setError("");
    onDraftChange(stageAttachmentUpload(draft, file, category, { id: `local-${crypto.randomUUID()}`, url: URL.createObjectURL(file) }));
  }

  return (
    <div>
      <h3 className="mb-4 text-base font-semibold text-logoblue">{t("Attachments", "Vedlegg")}</h3>
      <OrderAttachmentsSection
        attachments={shown}
        uploading={false}
        error={error}
        onUpload={pick}
        onDelete={(attachmentId) => onDraftChange(stageAttachmentRemoval(draft, attachmentId))}
        locale={locale}
        categories={["ATTACHMENT"]}
      />
      {hasAttachmentChanges(draft) && (
        <p className="mt-3 text-xs text-black/55">
          {t("File changes are stored when you press Save.", "Filendringene lagres når du trykker Lagre.")}
        </p>
      )}
    </div>
  );
}
