"use client";

import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { CustomerType } from "@/lib/booking/pricing/vatDisplayTotal";

// The very first question in every booking modal that ends up showing
// prices: private customers care about what they actually pay (incl. VAT),
// business customers reclaim VAT and care about the ex-VAT price (see
// getVatDisplayTotal). Asking this before anything else — rather than
// defaulting to "private" and leaving the answer to a toggle discovered
// later, next to the calculator — means every price the customer sees for
// the rest of the flow is already in the right mode from the start.
export function CustomerTypeStep({
  locale,
  value,
  onPick,
}: {
  locale: Locale;
  // The section stays visible (not active) once answered — same as
  // WebsiteListTiles' selectedCode — so the chosen option keeps its
  // logoblue highlight instead of reverting to unselected.
  value: CustomerType | null;
  onPick: (customerType: CustomerType) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const options: { id: CustomerType; label: string }[] = [
    { id: "private", label: t("Private", "Privat") },
    { id: "business", label: t("Business", "Bedrift") },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(option.id)}
            className={[
              "flex w-48 flex-col items-center gap-1 rounded-2xl border px-4 py-5 text-center transition",
              selected
                ? "border-logoblue bg-logoblue/5"
                : "border-black/10 hover:-translate-y-0.5 hover:border-logoblue/40 hover:shadow-md",
            ].join(" ")}
          >
            <span className={["text-base font-semibold", selected ? "text-logoblue" : "text-black/80"].join(" ")}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
