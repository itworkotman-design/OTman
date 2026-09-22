"use client";

import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { CustomerType } from "@/lib/booking/pricing/vatDisplayTotal";

type Props = {
  locale: Locale;
  value: CustomerType;
  onChange: (customerType: CustomerType) => void;
};

// Private customers see incl.-VAT prices as the headline number (what they
// actually pay); business customers see ex-VAT (what they reclaim against).
// Display-only — this never changes pricing, eligibility, or the catalog,
// only which of the two already-computed totals is shown large vs. small.
export function CustomerTypeToggle({ locale, value, onChange }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const options: { id: CustomerType; label: string }[] = [
    { id: "private", label: t("Private", "Privat") },
    { id: "business", label: t("Business", "Bedrift") },
  ];

  return (
    <div role="group" aria-label={t("Customer type", "Kundetype")} className="inline-flex shrink-0 rounded-full bg-logoblue/5 p-0.5 text-xs font-semibold">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={[
              "rounded-full px-3 py-1.5 transition",
              active ? "bg-logoblue text-white" : "text-logoblue/70 hover:text-logoblue",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
