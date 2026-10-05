"use client";

import { useEffect, useState } from "react";
import OrderAttachmentsSection from "@/app/_components/Dahsboard/booking/create/OrderAttachmentsSection";
import type { AttachmentCategory, AttachmentItem } from "@/lib/orders/attachmentCategories";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  orderId: string;
  locale: BookingUiLocale;
};

// Attachments of a website order (no receipts — those are for the regular
// booking flow), straight in WebsiteOrderModal
// — the same section and endpoints the regular order editor uses
// (/api/orders/[orderId]/attachments, /api/orders/attachments/[id]). Uploads
// and deletes take effect immediately; there is no form to save.
export default function WebsiteOrderAttachments({ orderId, locale }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${orderId}/attachments`, { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok) setAttachments(data.attachments ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function upload(file: File, category: AttachmentCategory) {
    try {
      setUploading(true);
      setError("");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      const res = await fetch(`/api/orders/${orderId}/attachments`, { method: "POST", body: formData, credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.reason || t("Upload failed", "Opplasting feilet"));
        return;
      }
      setAttachments((current) => [data.attachment, ...current]);
    } catch {
      setError(t("Upload failed", "Opplasting feilet"));
    } finally {
      setUploading(false);
    }
  }

  async function remove(attachmentId: string) {
    if (!confirm(t("Delete this file?", "Slette denne filen?"))) return;
    try {
      setError("");
      const res = await fetch(`/api/orders/attachments/${attachmentId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.reason || t("Delete failed", "Sletting feilet"));
        return;
      }
      setAttachments((current) => current.filter((item) => item.id !== attachmentId));
    } catch {
      setError(t("Delete failed", "Sletting feilet"));
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-logoblue">{t("Attachments", "Vedlegg")}</h3>
      <OrderAttachmentsSection
        attachments={attachments}
        uploading={uploading}
        error={error}
        onUpload={upload}
        onDelete={remove}
        locale={locale}
        categories={["ATTACHMENT"]}
      />
    </div>
  );
}
