// path: app/_components/Dahsboard/booking/archive/SelectionActionBar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookingArchiveOption } from "./types";

type EmailType = "prepare_orders" | "confirmed_delivery" | "custom" | "";

type Props = {
  creators: (BookingArchiveOption & {
    email?: string | null;
    warehouseEmail?: string | null;
  })[];
  selectedCount: number;
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
  onResendGsm?: () => void | Promise<boolean>;
  showResendGsm?: boolean;
  onCopySelected: () => void | Promise<void>;
  onExportExcel: () => void | Promise<void>;
  onManageColumns: () => void;
  loading?: boolean;
  error?: string;
};

export default function SelectionActionBar({
  creators,
  selectedCount,
  onSendEmail,
  onSendGsm,
  onResendGsm,
  showResendGsm = false,
  onCopySelected,
  onExportExcel,
  onManageColumns,
  loading = false,
  error = "",
}: Props) {
  const [creatorId, setCreatorId] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("");
  const [customMessage, setCustomMessage] = useState("");
  const [sendToPrimaryEmail, setSendToPrimaryEmail] = useState(false);
  const [sendToWarehouseEmail, setSendToWarehouseEmail] = useState(false);
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
    <section className="customContainer mt-4 max-w-[1100]">
      <div className="grid items-start gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird">
            Creator
          </label>
          <select
            value={creatorId}
            onChange={(e) => {
              const nextCreatorId = e.target.value;
              const nextCreator = creators.find(
                (item) => item.id === nextCreatorId,
              );

              setCreatorId(nextCreatorId);
              setSendToPrimaryEmail(false);
              setSendToWarehouseEmail(
                !!nextCreator?.warehouseEmail?.trim(),
              );
            }}
            className="customInput w-full"
            disabled={loading}
          >
            <option value="">Select creator...</option>
            {creators.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div >
          <label className="mb-1 block text-xs font-medium text-textColorThird">
            Email type
          </label>
          <select
            value={emailType}
            onChange={(e) => setEmailType(e.target.value as EmailType)}
            className="customInput w-full"
            disabled={loading}
          >
            <option value="">Select type...</option>
            <option value="prepare_orders">Forbered bestillinger</option>
            <option value="confirmed_delivery">Bekreftet for levering</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {selectedCreator ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-textColorThird">
              Recipients
            </label>
            <div className="flex min-h-10 flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendToPrimaryEmail}
                  disabled={!primaryEmail || loading}
                  onChange={(e) => setSendToPrimaryEmail(e.target.checked)}
                />
                <span>
                  Send to 
                  {primaryEmail ? ` - ${primaryEmail}` : " - no email set"}
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendToWarehouseEmail}
                  disabled={!warehouseEmail || loading}
                  onChange={(e) => setSendToWarehouseEmail(e.target.checked)}
                />
                <span>
                  Send to 
                  {warehouseEmail
                    ? ` - ${warehouseEmail}`
                    : " - no warehouse email set"}
                </span>
              </label>
            </div>
          </div>
        ) : null}

        {emailType === "custom" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-textColorThird">
              Custom message
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              className="customInput w-full resize-none"
              placeholder="Write custom email message..."
            />
          </div>
        )}

        <button
          type="button"
          disabled={disabled || !canSendEmail}
          onClick={handleSendEmailClick}
          className={`mt-5 h-10 disabled:opacity-50! disabled:cursor-auto! ${
            successFlash
              ? "customButtonEnabled bg-green-600!"
              : "customButtonEnabled"
          }`}
        >
          {loading ? "Sending..." : successFlash ? "Sent" : "Send email"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={handleSendGsmClick}
          className={`h-10 disabled:opacity-50! disabled:cursor-auto! ${
            gsmSuccessFlash
              ? "customButtonEnabled bg-green-600!"
              : "customButtonDefault"
          }`}
        >
          {loading
            ? "Sending..."
            : gsmSuccessFlash
              ? "Sent to GSM"
              : "Send to GSM"}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onCopySelected}
          className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto!"
        >
          Copy selected
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onExportExcel}
          className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto!"
        >
          Export Excel
        </button>

        <button
          type="button"
          onClick={onManageColumns}
          className="customButtonDefault h-10"
        >
          Hide columns
        </button>
      </div>

      {gsmSuccessFlash ? (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          Selected orders were sent to GSM.
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-center gap-3 text-sm font-medium text-red-600">
          <span>{error}</span>

          {showResendGsm && onResendGsm ? (
            <button
              type="button"
              onClick={() => void onResendGsm()}
              className="customButtonDefault h-8"
            >
              Resend anyway
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
