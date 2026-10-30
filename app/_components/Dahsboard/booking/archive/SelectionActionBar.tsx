// path: app/_components/Dahsboard/booking/archive/SelectionActionBar.tsx
"use client";

import { useEffect, useState } from "react";
import {
  RiCheckLine,
  RiFileCopyLine,
  RiFileExcel2Line,
  RiLayoutColumnLine,
  RiLoader4Line,
  RiMailSendLine,
  RiMessage2Line,
  RiTruckLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  selectedCount: number;
  locale?: BookingUiLocale;
  onSendGsm: () => void | Promise<boolean>;
  // Optional: the Website orders page leaves Copy out (a copy would lose the
  // website-order flag, public order number and customer login).
  onCopySelected?: () => void | Promise<void>;
  onExportExcel: () => void | Promise<void>;
  onManageColumns: () => void;
  // Optional so other users of the bar (e.g. Insurance cases) can leave SMS out.
  onSendSms?: () => void;
  // Opens the prepare-orders confirmation modal: one email per pickup
  // address/store of the selected orders (see PrepareEmailModal). Left out on
  // the Insurance cases page.
  onSendPrepareToSelected?: () => void;
  prepareResult?: string;
  loading?: boolean;
  error?: string;
  gsmDuplicateWarning?: string[];
  // Defaults true; the Insurance cases page turns it off (those orders aren't
  // dispatched to GSM from that list).
  showSendGsm?: boolean;
};

// One segment of the action group: icon + short label, full description as
// tooltip. Phones stack the icon above the label so the group fits one row.
function ActionButton({
  icon: Icon,
  label,
  title,
  onClick,
  disabled,
  success = false,
}: {
  icon: RemixiconComponentType;
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  success?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-3 py-1.5 text-[11px] font-medium transition sm:h-10 sm:flex-none sm:flex-row sm:gap-1.5 sm:py-0 sm:text-sm height-weird-landscape disabled:cursor-auto! disabled:opacity-40 ${
        success ? "bg-green-50 text-green-700" : "text-textColorSecond hover:bg-slate-50 hover:text-logoblue"
      }`}
    >
      <Icon size={18} aria-hidden className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function SelectionActionBar({
  selectedCount,
  locale,
  onSendGsm,
  onCopySelected,
  onExportExcel,
  onManageColumns,
  onSendSms,
  onSendPrepareToSelected,
  prepareResult = "",
  loading = false,
  error = "",
  gsmDuplicateWarning = [],
  showSendGsm = true,
}: Props) {
  const t = (text: string) => bookingText(locale, text);

  const [gsmSuccessFlash, setGsmSuccessFlash] = useState(false);

  const disabled = selectedCount === 0 || loading;

  useEffect(() => {
    if (!gsmSuccessFlash) return;

    const t = window.setTimeout(() => {
      setGsmSuccessFlash(false);
    }, 1600);

    return () => window.clearTimeout(t);
  }, [gsmSuccessFlash]);

  async function handleSendGsmClick() {
    if (disabled) return;

    const ok = await onSendGsm();
    if (!ok) return;

    setGsmSuccessFlash(true);
  }

  return (
    <section className="text-weird-landscape">
      <div className="flex flex-wrap items-center gap-2">
        {onSendPrepareToSelected ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSendPrepareToSelected}
            title={t("Sends one prepare-orders email per pickup address (or store if the pickup has no main user).")}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-logoblue px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 sm:w-auto height-weird-landscape disabled:cursor-auto! disabled:opacity-40 disabled:hover:brightness-100"
          >
            {loading ? (
              <RiLoader4Line size={18} aria-hidden className="animate-spin" />
            ) : (
              <RiMailSendLine size={18} aria-hidden />
            )}
            {t("Prepare")}
            {selectedCount > 0 ? (
              <span className="rounded-full bg-white/20 px-1.5 text-xs font-semibold tabular-nums">{selectedCount}</span>
            ) : null}
          </button>
        ) : null}

        <div className="flex w-full divide-x divide-black/10 overflow-hidden rounded-xl border border-black/10 bg-white sm:w-auto">
          {showSendGsm && (
            <ActionButton
              icon={gsmSuccessFlash ? RiCheckLine : RiTruckLine}
              label={gsmSuccessFlash ? t("Sent") : "GSM"}
              title={t("Send to GSM")}
              onClick={handleSendGsmClick}
              disabled={disabled}
              success={gsmSuccessFlash}
            />
          )}
          {onSendSms && (
            <ActionButton icon={RiMessage2Line} label="SMS" title={t("Send SMS")} onClick={onSendSms} disabled={disabled} />
          )}
          {onCopySelected && (
            <ActionButton
              icon={RiFileCopyLine}
              label={t("Copy")}
              title={t("Copy selected")}
              onClick={() => void onCopySelected()}
              disabled={disabled}
            />
          )}
          <ActionButton
            icon={RiFileExcel2Line}
            label="Excel"
            title={t("Export Excel")}
            onClick={() => void onExportExcel()}
            disabled={disabled}
          />
        </div>

        {/* Not tied to the selection, so it's its own button after the group. */}
        <button
          type="button"
          onClick={onManageColumns}
          title={t("Hide columns")}
          aria-label={t("Hide columns")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-textColorSecond transition hover:bg-slate-50 hover:text-logoblue height-weird-landscape"
        >
          <RiLayoutColumnLine size={18} aria-hidden />
          {t("Columns")}
        </button>
      </div>

      {gsmSuccessFlash ? (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 text-weird-landscape">
          {t("Selected orders were sent to GSM.")}
        </div>
      ) : null}

      {prepareResult ? (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 text-weird-landscape">
          {prepareResult}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 text-weird-landscape">
          {error}
        </div>
      ) : null}

      {gsmDuplicateWarning.length > 0 ? (
        <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 text-weird-landscape">
          {t("The following orders were already sent to GSM and were sent again — GSM will handle any duplicates:")}{" "}
          <span className="font-medium">{gsmDuplicateWarning.join(", ")}</span>
        </div>
      ) : null}
    </section>
  );
}
