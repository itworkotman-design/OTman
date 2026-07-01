// path: app/_components/Dahsboard/booking/archive/SelectionActionBar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookingArchiveOption } from "./types";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type EmailType = "prepare_orders" | "confirmed_delivery" | "custom" | "";

type Props = {
  creators: (BookingArchiveOption & {
    email?: string | null;
    warehouseEmail?: string | null;
  })[];
  selectedStoreId?: string;
  selectedCount: number;
  locale?: BookingUiLocale;
  onSendEmail: (payload: {
    recipients: Array<{
      email: string;
      name?: string;
    }>;
    subject: string;
    message?: string;
    recipientName?: string;
  }) => void | Promise<boolean>;
  onSendGsm: () => void | Promise<boolean>;
  onCopySelected: () => void | Promise<void>;
  onExportExcel: () => void | Promise<void>;
  onManageColumns: () => void;
  loading?: boolean;
  error?: string;
  gsmDuplicateWarning?: string[];
};

export default function SelectionActionBar({
  creators,
  selectedStoreId,
  selectedCount,
  locale,
  onSendEmail,
  onSendGsm,
  onCopySelected,
  onExportExcel,
  onManageColumns,
  loading = false,
  error = "",
  gsmDuplicateWarning = [],
}: Props) {
  const t = (text: string) => bookingText(locale, text);

  const [creatorId, setCreatorId] = useState(selectedStoreId ?? "");
  const [emailType, setEmailType] = useState<EmailType>("");
  const [customMessage, setCustomMessage] = useState("");
  const [sendToPrimaryEmail, setSendToPrimaryEmail] = useState(false);
  const [sendToWarehouseEmail, setSendToWarehouseEmail] = useState(false);

  useEffect(() => {
    setCreatorId(selectedStoreId ?? "");
    setSendToPrimaryEmail(false);
    setSendToWarehouseEmail(false);
  }, [selectedStoreId]);
  const [successFlash, setSuccessFlash] = useState(false);
  const [gsmSuccessFlash, setGsmSuccessFlash] = useState(false);

  const disabled = selectedCount === 0 || loading;

  const selectedCreator = useMemo(
    () => creators.find((item) => item.id === creatorId),
    [creators, creatorId],
  );
  const primaryEmail = selectedCreator?.email?.trim() || "";
  const warehouseEmail = selectedCreator?.warehouseEmail?.trim() || "";
  const selectedRecipients = useMemo(() => {
    const recipients: Array<{ email: string; name?: string }> = [];

    if (sendToPrimaryEmail && primaryEmail) {
      recipients.push({
        email: primaryEmail,
        name: selectedCreator?.label,
      });
    }

    if (
      sendToWarehouseEmail &&
      warehouseEmail &&
      warehouseEmail !== primaryEmail
    ) {
      recipients.push({
        email: warehouseEmail,
        name: selectedCreator?.label,
      });
    }

    return recipients;
  }, [
    primaryEmail,
    selectedCreator?.label,
    sendToPrimaryEmail,
    sendToWarehouseEmail,
    warehouseEmail,
  ]);

  const subject = useMemo(() => {
    switch (emailType) {
      case "prepare_orders":
        return "Forbered bestillinger";
      case "confirmed_delivery":
        return "Bekreftet for levering";
      case "custom":
        return "Melding om bestillinger";
      default:
        return "";
    }
  }, [emailType]);

  const message = useMemo(() => {
    switch (emailType) {
      case "prepare_orders":
        return "Hei,\n\nSe valgte bestillinger nedenfor.";
      case "confirmed_delivery":
        return "Hei,\n\nFÃ¸lgende bestillinger er bekreftet for levering.";
      case "custom":
        return customMessage.trim();
      default:
        return "";
    }
  }, [emailType, customMessage]);

  const canSendEmail =
    selectedRecipients.length > 0 &&
    !!emailType &&
    (emailType !== "custom" || !!customMessage.trim());

  useEffect(() => {
    if (!successFlash) return;

    const t = window.setTimeout(() => {
      setSuccessFlash(false);
    }, 1000);

    return () => window.clearTimeout(t);
  }, [successFlash]);

  useEffect(() => {
    if (!gsmSuccessFlash) return;

    const t = window.setTimeout(() => {
      setGsmSuccessFlash(false);
    }, 1600);

    return () => window.clearTimeout(t);
  }, [gsmSuccessFlash]);

  async function handleSendEmailClick() {
    if (!canSendEmail || disabled || !selectedCreator) return;

    const ok = await onSendEmail({
      recipients: selectedRecipients,
      subject,
      message: message || undefined,
      recipientName: selectedCreator.label,
    });

    if (!ok) return;

    setSuccessFlash(true);
    setEmailType("");
    setCustomMessage("");
  }

  async function handleSendGsmClick() {
    if (disabled) return;

    const ok = await onSendGsm();
    if (!ok) return;

    setGsmSuccessFlash(true);
  }

  return (
    <section className="customContainer mt-4 max-w-[1100] padding-weird-landscape margin-weird-landscape text-weird-landscape padding-weird-landscape [@media_(orientation:landscape)_and_(max-height:800px)_and_(min-width:900px)]:max-w-[700] [@media_(orientation:landscape)_and_(max-height:800px)_and_(min-width:900px)]:shadow-none!">
      <div className="grid items-start gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird text-weird-landscape">{t("Store")}</label>
          <select
            value={creatorId}
            onChange={(e) => {
              const nextCreatorId = e.target.value;
              const nextCreator = creators.find((item) => item.id === nextCreatorId);

              setCreatorId(nextCreatorId);
              setSendToPrimaryEmail(false);
              setSendToWarehouseEmail(!!nextCreator?.warehouseEmail?.trim());
            }}
            className="customInput w-full padding-weird-landscape"
            disabled={loading}
          >
            <option value="">{t("Select store...")}</option>
            {creators.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird text-weird-landscape padding">{t("Email type")}</label>
          <select
            value={emailType}
            onChange={(e) => setEmailType(e.target.value as EmailType)}
            className="customInput w-full  padding-weird-landscape"
            disabled={loading}
          >
            <option value="">{t("Select type...")}</option>
            <option value="prepare_orders">{t("Prepare orders")}</option>
            <option value="confirmed_delivery">{t("Confirmed for delivery")}</option>
            <option value="custom">{t("Custom")}</option>
          </select>
        </div>

        {selectedCreator ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-textColorThird text-weird-landscape">{t("Recipients")}</label>
            <div className="flex min-h-10 flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-weird-landscape">
                <input
                  type="checkbox"
                  checked={sendToPrimaryEmail}
                  disabled={!primaryEmail || loading}
                  onChange={(e) => setSendToPrimaryEmail(e.target.checked)}
                />
                <span>
                  {t("Send to")}
                  {primaryEmail ? ` - ${primaryEmail}` : ` - ${t("no email set")}`}
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-weird-landscape ">
                <input
                  type="checkbox"
                  checked={sendToWarehouseEmail}
                  disabled={!warehouseEmail || loading}
                  onChange={(e) => setSendToWarehouseEmail(e.target.checked)}
                />
                <span>
                  {t("Send to")}
                  {warehouseEmail ? ` - ${warehouseEmail}` : ` - ${t("no warehouse email set")}`}
                </span>
              </label>
            </div>
          </div>
        ) : null}

        {emailType === "custom" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-textColorThird text-weird-landscape">{t("Custom message")}</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              className="customInput w-full resize-none padding-weird-landscape"
              placeholder={t("Write custom email message...")}
            />
          </div>
        )}

        <button
          type="button"
          disabled={disabled || !canSendEmail}
          onClick={handleSendEmailClick}
          className={`mt-5 h-10 disabled:opacity-50! disabled:cursor-auto! margin-weird-landscape height-weird-landscape ${successFlash ? "customButtonEnabled bg-green-600!" : "customButtonEnabled "}`}
        >
          {loading ? t("Sending...") : successFlash ? t("Sent") : t("Send email")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={handleSendGsmClick}
          className={`h-10 disabled:opacity-50! disabled:cursor-auto! height-weird-landscape ${gsmSuccessFlash ? "customButtonEnabled bg-green-600!" : "customButtonDefault"}`}
        >
          {loading ? t("Sending...") : gsmSuccessFlash ? t("Sent to GSM") : t("Send to GSM")}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onCopySelected}
          className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto! height-weird-landscape"
        >
          {t("Copy selected")}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onExportExcel}
          className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto! height-weird-landscape"
        >
          {t("Export Excel")}
        </button>

        <button type="button" onClick={onManageColumns} className="customButtonDefault h-10 height-weird-landscape">
          {t("Hide columns")}
        </button>
      </div>

      {gsmSuccessFlash ? (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 text-weird-landscape">
          {t("Selected orders were sent to GSM.")}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 text-sm font-medium text-red-600 text-weird-landscape">
          {error}
        </div>
      ) : null}

      {gsmDuplicateWarning.length > 0 ? (
        <div className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 text-weird-landscape">
          {t("The following orders were already sent to GSM and were sent again — GSM will handle any duplicates:")}{" "}
          <span className="font-medium">{gsmDuplicateWarning.join(", ")}</span>
        </div>
      ) : null}
    </section>
  );
}
