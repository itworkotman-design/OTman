"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { bookingStatusText, bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type PartnerOption = { id: string; label: string };

type SingleModeProps = {
  mode: "single";
  status: string;
  partners: PartnerOption[];
  onLeaveWithoutPartner: () => void;
  onChoosePartner: (partnerId: string) => void;
};

type BulkModeProps = {
  mode: "bulk";
  status: string;
  // Display labels (e.g. "#22593") of the selected orders that have no partner.
  missingOrderLabels: string[];
  onIgnore: () => void;
  onFixNow: () => void;
};

type Props = (SingleModeProps | BulkModeProps) & {
  open: boolean;
  onCancel: () => void;
  locale?: BookingUiLocale;
};

// Shown on top of the order modal / bulk bar when an order is moved into
// failed/completed/invoiced/paid without a partner. Sits above OrderModal
// (z-50) and swallows Escape so it doesn't also close the order underneath.
// The body only mounts while open, so its choice state starts fresh each time.
export default function MissingPartnerDialog(props: Props) {
  if (!props.open) return null;
  return <MissingPartnerDialogBody {...props} />;
}

function MissingPartnerDialogBody(props: Props) {
  const { onCancel, locale = "en" } = props;
  const t = (text: string) => bookingText(locale, text);
  const [choice, setChoice] = useState<"leave" | "choose">("leave");
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancel();
    }

    // Capture phase on window runs before OrderModal's document listener.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onCancel]);

  const statusLabel = bookingStatusText(locale, props.status);

  function handleContinue() {
    if (props.mode !== "single") return;
    if (choice === "leave") {
      props.onLeaveWithoutPartner();
      return;
    }
    if (partnerId) props.onChoosePartner(partnerId);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md customContainer bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-bold text-logoblue">{t("No partner selected")}</h2>

        {props.mode === "single" ? (
          <>
            <p className="mb-4 text-sm text-textColorThird">
              {t("You are setting the status to")} <strong>{statusLabel}</strong>{" "}
              {t("without a partner.")}
            </p>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="missing-partner-choice"
                  checked={choice === "leave"}
                  onChange={() => setChoice("leave")}
                />
                {t("Leave without partner")}
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="missing-partner-choice"
                  checked={choice === "choose"}
                  onChange={() => setChoice("choose")}
                />
                {t("Choose partner")}
              </label>

              {choice === "choose" ? (
                <select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="customInput w-full"
                  autoFocus
                >
                  <option value="">{t("Choose")}</option>
                  {props.partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onCancel} className="customButtonDefault">
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={choice === "choose" && !partnerId}
                className="customButtonEnabled disabled:opacity-50! disabled:cursor-auto!"
              >
                {t("Continue")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-textColorThird">
              {t("These orders will be set to")} <strong>{statusLabel}</strong>{" "}
              {t("without a partner:")}
            </p>

            <ul className="mb-4 max-h-48 overflow-auto rounded-md border border-gray-200 p-2 text-sm">
              {props.missingOrderLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={props.onFixNow} className="customButtonDefault">
                {t("I'll fix it now")}
              </button>
              <button type="button" onClick={props.onIgnore} className="customButtonEnabled">
                {t("Ignore")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
