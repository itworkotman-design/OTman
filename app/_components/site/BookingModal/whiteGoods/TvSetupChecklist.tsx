"use client";

import type { Locale } from "@/lib/content/ServiceWindowContent";
import {
  TV_SETUP_CHECKLIST,
  TV_SETUP_PROVIDERS,
  type TvSetupDetails,
  type TvSetupProvider,
} from "@/lib/booking/tvSetup";
import { MAX_ITEM_NAME_LENGTH } from "@/lib/booking/pricing/sizeBrackets";
import { sanitizeTextInput } from "@/lib/orders/websiteOrderValidation";

// Opens under "TV setup" in the TV card's additional services: which TV provider the
// customer uses, and a list of what the technician needs on site, which the
// customer confirms having with one tick before the order can go on
// (lib/booking/tvSetup.ts).

const EMPTY: TvSetupDetails = { provider: "", providerName: "", confirmedItems: [] };

export function TvSetupChecklist({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: TvSetupDetails | null | undefined;
  onChange: (next: TvSetupDetails) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const details = value ?? EMPTY;

  const setProvider = (provider: TvSetupProvider) =>
    onChange({ ...details, provider, providerName: provider === "OTHER" ? details.providerName : "" });

  // One confirmation for the whole list; stored as every item confirmed.
  const allConfirmed = TV_SETUP_CHECKLIST.every((item) => details.confirmedItems.includes(item.key));
  const toggleAll = () =>
    onChange({ ...details, confirmedItems: allConfirmed ? [] : TV_SETUP_CHECKLIST.map((item) => item.key) });

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
        {t(
          "Have everything below ready when we arrive. If anything is missing, the setup is stopped, a wasted-trip fee is charged and a new visit must be booked and paid for.",
          "Ha alt nedenfor klart når vi kommer. Mangler noe, stoppes monteringen, det belastes bomtur, og et nytt besøk må bestilles og betales.",
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-black/70">
          {t("Which TV provider do you use?", "Hvilken TV-leverandør bruker du?")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {TV_SETUP_PROVIDERS.map((provider) => {
            const selected = details.provider === provider.key;
            return (
              <button
                key={provider.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setProvider(provider.key)}
                className={[
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
                  selected
                    ? "border-logoblue bg-logoblue text-white"
                    : "border-black/15 bg-white text-black/75 hover:border-black/30",
                ].join(" ")}
              >
                {provider.name ?? t("Other", "Annen")}
              </button>
            );
          })}
        </div>
        {details.provider === "OTHER" && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-black/70">
              {t("Which provider?", "Hvilken leverandør?")}
            </span>
            <input
              type="text"
              value={details.providerName}
              maxLength={MAX_ITEM_NAME_LENGTH}
              onChange={(e) => onChange({ ...details, providerName: sanitizeTextInput(e.target.value) })}
              placeholder={t("e.g. Telia, RiksTV, Allente", "f.eks. Telia, RiksTV, Allente")}
              className="h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm text-black/85 outline-none transition focus:border-logoblue focus:ring-2 focus:ring-logoblue/20"
            />
          </label>
        )}
      </fieldset>

      <div>
        <div className="mb-1.5 text-sm font-medium text-black/70">
          {t("You need to have ready:", "Du må ha klart:")}
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-black/80">
          {TV_SETUP_CHECKLIST.map((item) => (
            <li key={item.key}>{t(item.en, item.no)}</li>
          ))}
        </ul>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-black/15 bg-white px-3 py-2.5 text-sm font-semibold text-black/85">
          <input
            type="checkbox"
            checked={allConfirmed}
            onChange={toggleAll}
            className="mt-0.5 h-4 w-4 shrink-0 accent-logoblue"
          />
          <span>{t("I confirm I have all of this ready", "Jeg bekrefter at jeg har alt dette klart")}</span>
        </label>
      </div>
    </div>
  );
}
