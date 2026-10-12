"use client";

import type { Locale } from "@/lib/content/ServiceWindowContent";
import { sanitizePhoneInput, sanitizeTextInput } from "@/lib/orders/websiteOrderValidation";
import { PersonIcon, PhoneIcon } from "./orderDetailsIcons";
import { FieldLabel, inputClass } from "./formFieldStyles";

// "My order" within 24h of the job: the contact person at each private or
// business pickup — still changeable then, unlike the stop itself. A store
// pickup has no contact person, so it isn't listed.

export type PickupContactPerson = {
  key: string;
  title: string;
  address: string;
  name: string;
  phone: string;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
};

export function PickupContactPersonsCard({ locale, stops }: { locale: Locale; stops: PickupContactPerson[] }) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  return (
    <div className="flex flex-col gap-4">
      {stops.map((stop) => (
        <div key={stop.key} className="rounded-2xl border border-black/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-black/85">{stop.title}</h3>
          {stop.address && <p className="mt-0.5 text-xs text-black/50">{stop.address}</p>}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel icon={<PersonIcon className="h-4 w-4" />}>{t("Contact person", "Kontaktperson")}</FieldLabel>
              <input
                type="text"
                value={stop.name}
                onChange={(e) => stop.onName(sanitizeTextInput(e.target.value))}
                placeholder={t("Full name", "Fullt navn")}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel icon={<PhoneIcon className="h-4 w-4" />}>{t("Phone", "Telefon")}</FieldLabel>
              <input
                type="tel"
                value={stop.phone}
                onChange={(e) => stop.onPhone(sanitizePhoneInput(e.target.value))}
                placeholder={t("e.g. 41234567", "f.eks. 41234567")}
                className={inputClass}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
