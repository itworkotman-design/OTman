"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RecurrenceType } from "@prisma/client";
import BookingEditor, {
  type OrderFormPayload,
} from "@/app/_components/Dahsboard/booking/BookingEditor";
import { OrderFields } from "@/app/_components/Dahsboard/booking/create/orderFields";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { getOsloDateKey } from "@/lib/dates/isoDate";
import { computeUpcomingOccurrenceDates } from "@/lib/orders/recurringOrders/occurrenceDates";
import RecurrencePicker, {
  type RecurrenceConfigDraft,
} from "@/app/_components/Dahsboard/automaticOrders/RecurrencePicker";

// Delivery date is computed per occurrence from the recurrence rule, so it's
// hidden — but order number is a free-text reference used for filtering, not
// tied to a specific occurrence, so it stays editable and is reused as-is on
// every order generated from this template.
const HIDDEN_FOR_TEMPLATE = OrderFields.DeliveryDate;

export type AutomaticOrderTemplate = {
  id: string;
  name: string;
  recurrenceType: RecurrenceType;
  recurrenceConfig: unknown;
  leadTimeDays: number;
  startDate: string;
  endDate: string | null;
  orderDefaults: unknown;
};

type Props = {
  open: boolean;
  template: AutomaticOrderTemplate | null;
  onClose: () => void;
  onSaved: () => void;
  locale?: BookingUiLocale;
};

function toDraftConfig(type: RecurrenceType, config: unknown): RecurrenceConfigDraft {
  const candidate = (config ?? {}) as Record<string, unknown>;

  return {
    weekdays: type === "WEEKLY" && Array.isArray(candidate.weekdays) ? (candidate.weekdays as number[]) : [],
    dayOfMonth: type === "MONTHLY" && typeof candidate.dayOfMonth === "number" ? candidate.dayOfMonth : 1,
    dates: type === "CUSTOM_DATES" && Array.isArray(candidate.dates) ? (candidate.dates as string[]) : [],
  };
}

function toStoredConfig(type: RecurrenceType, draft: RecurrenceConfigDraft) {
  if (type === "WEEKLY") return { weekdays: draft.weekdays };
  if (type === "MONTHLY") return { dayOfMonth: draft.dayOfMonth };
  return { dates: draft.dates };
}

function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

export default function AutomaticOrderModal({ open, template, onClose, onSaved, locale = "en" }: Props) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("WEEKLY");
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfigDraft>({
    weekdays: [],
    dayOfMonth: 1,
    dates: [],
  });
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [startDate, setStartDate] = useState(() => getOsloDateKey());
  const [endDate, setEndDate] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recurrenceInvalid, setRecurrenceInvalid] = useState(false);
  const recurrenceSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    if (template) {
      setName(template.name);
      setRecurrenceType(template.recurrenceType);
      setRecurrenceConfig(toDraftConfig(template.recurrenceType, template.recurrenceConfig));
      setLeadTimeDays(template.leadTimeDays);
      setStartDate(template.startDate);
      setEndDate(template.endDate);
    } else {
      setName("");
      setRecurrenceType("WEEKLY");
      setRecurrenceConfig({ weekdays: [], dayOfMonth: 1, dates: [] });
      setLeadTimeDays(3);
      setStartDate(getOsloDateKey());
      setEndDate(null);
    }
    setError("");
    setRecurrenceInvalid(false);
  }, [open, template]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const previewDates = useMemo(() => {
    return computeUpcomingOccurrenceDates(
      {
        recurrenceType,
        recurrenceConfig: toStoredConfig(recurrenceType, recurrenceConfig),
        startDate,
        endDate,
      },
      { from: getOsloDateKey(), count: 3 },
    );
    // leadTimeDays doesn't change which dates match the recurrence rule, but
    // is included so the preview visibly recomputes alongside every other
    // recurrence-related field, per the "live preview" requirement.
  }, [recurrenceType, recurrenceConfig, startDate, endDate, leadTimeDays]);

  const bookingEditorInitialValues = useMemo(() => {
    if (!template) return undefined;
    // BookingEditor only skips its "auto-fill pickup/return address from the
    // selected customer" effect on first load when `initialValues.id` is
    // present — without it, resolving the saved customer on mount silently
    // overwrites the template's saved addresses with that customer's
    // default address. `orderDefaults` has no `id` of its own, so pass the
    // template's id to mark this as an edit of an existing record.
    return { ...(template.orderDefaults as Partial<OrderFormPayload>), id: template.id };
  }, [template]);

  async function handleSubmit(payload: OrderFormPayload) {
    setError("");

    // Everything else in the order form is optional, same as the leniency
    // OWNER/ADMIN already get in the regular booking form — but the
    // recurrence selection is the one thing that actually makes this
    // "automatic": without at least one weekday/date picked it would never
    // fire, so it stays mandatory. Since the picker sits near the top of a
    // long form and the submit button is all the way at the bottom, a plain
    // error message up here would be easy to miss — so this also highlights
    // the picker and scrolls back up to it.
    const recurrenceIncomplete =
      (recurrenceType === "WEEKLY" && recurrenceConfig.weekdays.length === 0) ||
      (recurrenceType === "CUSTOM_DATES" && recurrenceConfig.dates.length === 0);

    if (recurrenceIncomplete) {
      setRecurrenceInvalid(true);
      setError(
        locale === "nb"
          ? "Velg minst én ukedag eller dato for gjentakelsen."
          : "Select at least one weekday or date for the recurrence.",
      );
      recurrenceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setRecurrenceInvalid(false);

    // Strip fields that don't belong in a reusable template: deliveryDate is
    // computed per occurrence, and price totals are always recalculated
    // fresh at generation time rather than frozen here. orderNumber is kept
    // — it's a free-text filtering reference, not occurrence-specific, and
    // is reused as-is on every order generated from this template.
    const {
      deliveryDate: _deliveryDate,
      priceExVat: _priceExVat,
      priceSubcontractor: _priceSubcontractor,
      ...orderDefaults
    } = payload;

    const body = {
      name: name.trim(),
      recurrenceType,
      recurrenceConfig: toStoredConfig(recurrenceType, recurrenceConfig),
      leadTimeDays,
      startDate,
      endDate,
      orderDefaults,
    };

    setSaving(true);
    try {
      const res = await fetch(
        template ? `/api/automatic-orders/${template.id}` : "/api/automatic-orders",
        {
          method: template ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.message || data?.reason || "Failed to save scheduler order");
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Failed to save scheduler order");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center px-3 py-6 lg:px-6 lg:py-10">
        <div
          className="flex max-h-[90vh] w-full max-w-[1700] flex-col rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b bg-white px-6 py-4">
            <h2 className="text-2xl font-semibold text-logoblue">
              {template
                ? locale === "nb" ? "Rediger planlagt bestilling" : "Edit scheduler order"
                : locale === "nb" ? "Ny planlagt bestilling" : "New scheduler order"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white cursor-pointer"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">
                {locale === "nb" ? "Navn" : "Name"}
              </label>
              <input
                type="text"
                className="customInput w-full max-w-md"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={locale === "nb" ? "F.eks. Ukentlig - Kunde AS" : "e.g. Weekly - Customer AS"}
              />
            </div>

            <div
              ref={recurrenceSectionRef}
              className={`mb-4 rounded-xl ${recurrenceInvalid ? "ring-2 ring-red-500" : ""}`}
            >
              <RecurrencePicker
                recurrenceType={recurrenceType}
                onRecurrenceTypeChange={(type) => {
                  setRecurrenceInvalid(false);
                  setRecurrenceType(type);
                }}
                recurrenceConfig={recurrenceConfig}
                onRecurrenceConfigChange={(config) => {
                  setRecurrenceInvalid(false);
                  setRecurrenceConfig(config);
                }}
                leadTimeDays={leadTimeDays}
                onLeadTimeDaysChange={setLeadTimeDays}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
                locale={locale}
              />
              {recurrenceInvalid ? (
                <p className="mt-1 text-sm font-medium text-red-600">
                  {locale === "nb"
                    ? "Påkrevd: velg minst én ukedag eller dato."
                    : "Required: select at least one weekday or date."}
                </p>
              ) : null}
            </div>

            <div className="mb-6 rounded-xl border border-lineSecondary p-4">
              <h4 className="mb-2 text-sm font-semibold text-logoblue">
                {locale === "nb" ? "Neste planlagte bestillinger" : "Next scheduler orders"}
              </h4>
              {previewDates.length > 0 ? (
                <ul className="text-sm text-textColorSecond">
                  {previewDates.map((date) => (
                    <li key={date}>{formatDisplayDate(date)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-textColorThird">
                  {locale === "nb" ? "Ingen kommende datoer funnet." : "No upcoming dates found."}
                </p>
              )}
            </div>

            <div className="mb-4 rounded-xl bg-linePrimary px-4 py-3 text-sm text-textColorSecond">
              {locale === "nb"
                ? "Priser beregnes på nytt når hver planlagte bestilling genereres."
                : "Prices are recalculated when each scheduler order is generated."}
            </div>

            {error ? <div className="mb-4 text-sm text-red-600">{error}</div> : null}

            <BookingEditor
              key={template?.id ?? "new"}
              hidden={HIDDEN_FOR_TEMPLATE}
              hideDontSendEmail
              onSubmit={handleSubmit}
              initialValues={bookingEditorInitialValues}
              locale={locale}
              isOrderCreator={false}
              showCapacityDetails={false}
            />
            {saving ? (
              <p className="mt-2 text-sm text-textColorThird">
                {bookingText(locale, "Saving...")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
