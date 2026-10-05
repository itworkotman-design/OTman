"use client";

import { useState } from "react";
import DatePicker from "@/app/_components/utils/DatePicker";
import { ContactDetailsCard } from "@/app/_components/site/BookingModal/whiteGoods/ContactDetailsCard";
import { TimeWindowField } from "@/app/_components/site/BookingModal/whiteGoods/timeWindowField";
import { FieldLabel } from "@/app/_components/site/BookingModal/whiteGoods/formFieldStyles";
import { CalendarIcon, ClockIcon } from "@/app/_components/site/BookingModal/whiteGoods/orderDetailsIcons";
import { addDaysIso, getOsloDateKey } from "@/lib/dates/isoDate";
import { isNorwegianPublicHoliday } from "@/lib/dates/norwayHolidays";
import { buildCustomerEditPayload, type CustomerEditDraft } from "./customerEditPayload";

type Props = {
  locale: "en" | "no";
  orderNumber: string;
  initial: CustomerEditDraft;
  beforeCutoff: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

// "Change order" for orders that aren't priced from the website catalog
// (moving, quotes): only contact details, notes and — until 24h before — the
// date and time window. Nothing here changes the price.
export default function CustomerOrderDetailsForm({ locale, orderNumber, initial, beforeCutoff, onCancel, onSaved }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const [name, setName] = useState(initial.customer.name);
  const [phone, setPhone] = useState(initial.customer.phone);
  const [email, setEmail] = useState(initial.customer.email);
  const [notes, setNotes] = useState(initial.customer.comments);
  const [preferredDate, setPreferredDate] = useState(initial.preferredDate);
  const [timeWindow, setTimeWindow] = useState(initial.timeWindow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const payload = buildCustomerEditPayload(
    initial,
    { customer: { name, phone, email, comments: notes }, preferredDate, timeWindow },
    beforeCutoff,
  );
  const hasChanges = Object.keys(payload).length > 0;

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/customer/orders/${encodeURIComponent(orderNumber)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        onSaved(t("Your order is updated.", "Bestillingen er oppdatert."));
        return;
      }
      setError(
        json?.reason === "INVALID_SCHEDULE"
          ? t(
              "Pick a date and time at least 24 hours ahead (not Sundays or public holidays).",
              "Velg dato og tid minst 24 timer frem i tid (ikke søndager eller helligdager).",
            )
          : json?.reason === "INVALID_DETAILS"
            ? t("Check your name, phone and email.", "Sjekk navn, telefon og e-post.")
            : t("Couldn't save the changes.", "Kunne ikke lagre endringene."),
      );
    } catch {
      setError(t("Couldn't save the changes.", "Kunne ikke lagre endringene."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ContactDetailsCard
        locale={locale}
        name={name}
        setName={setName}
        phone={phone}
        setPhone={setPhone}
        email={email}
        setEmail={setEmail}
        notes={notes}
        setNotes={setNotes}
      />
      {beforeCutoff && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-black/10 bg-white p-6 sm:grid-cols-2">
          <label className="block">
            <FieldLabel icon={<CalendarIcon className="h-4 w-4" />}>{t("Requested date", "Ønsket dato")}</FieldLabel>
            <DatePicker
              value={preferredDate}
              onChange={setPreferredDate}
              locale={locale}
              placeholder={t("Select a date", "Velg en dato")}
              minDate={addDaysIso(getOsloDateKey(), 1)}
              blockedWeekdays={[0]}
              isDateBlocked={isNorwegianPublicHoliday}
            />
          </label>
          <label className="block">
            <FieldLabel icon={<ClockIcon className="h-4 w-4" />}>{t("Time window", "Tidsvindu")}</FieldLabel>
            <TimeWindowField locale={locale} value={timeWindow} onChange={setTimeWindow} />
          </label>
        </div>
      )}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={!hasChanges || saving}
          className="inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? t("Saving…", "Lagrer…") : t("Save changes", "Lagre endringer")}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="text-sm font-semibold text-black/60">
          {t("Cancel", "Avbryt")}
        </button>
      </div>
    </div>
  );
}
