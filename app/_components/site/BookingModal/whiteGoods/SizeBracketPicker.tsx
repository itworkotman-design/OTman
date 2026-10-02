"use client";

import type { CatalogOption, CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import {
  MAX_ITEM_NAME_LENGTH,
  SIZE_VOLUME_CATEGORY,
  SIZE_WEIGHT_CATEGORY,
  resolveSizeBracketCharge,
} from "@/lib/booking/pricing/sizeBrackets";
import {
  SIZE_DIMENSION_CHOICES_CM,
  calculateVolumeM3,
  isCompleteDimensions,
  type SizeDimensionsCm,
} from "@/lib/booking/pricing/sizeDimensions";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { getVatDisplayAmount, type CustomerType } from "@/lib/booking/pricing/vatDisplayTotal";
import { sanitizeTextInput } from "@/lib/orders/websiteOrderValidation";

function optionLabel(locale: Locale, product: CatalogProduct, option: CatalogOption) {
  const seed = findWebsiteProductSeed(product.code)?.options.find((o) => o.code === option.code);
  if (!seed) return option.label;
  return locale === "no" ? seed.labelNo : seed.labelEn;
}

// A numbered step heading, so the three questions read as a short sequence.
function StepHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-start gap-2.5">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-logoblue text-[11px] font-bold text-white">
        {step}
      </span>
      <div>
        <div className="text-sm font-semibold leading-5 text-black/85">{title}</div>
        {hint && <p className="text-xs text-black/50">{hint}</p>}
      </div>
    </div>
  );
}

// What a size-priced product asks for once it is selected: what the item is, its
// width / height / length (preset choices — the volume is calculated from them,
// the customer never picks a volume) and its weight bracket. The price added on
// top of delivery is the higher of the volume's and the weight's bracket price,
// which the summary at the bottom says.
export function SizeBracketPicker({
  locale,
  customerType,
  product,
  selectedIds,
  dimensions,
  itemName,
  onSelect,
  onSelectDimension,
  onChangeItemName,
}: {
  locale: Locale;
  // Private customers see prices incl. VAT (what they actually pay);
  // business customers see ex-VAT (what they reclaim) — see
  // getVatDisplayAmount.
  customerType: CustomerType;
  product: CatalogProduct;
  selectedIds: string[];
  dimensions: Partial<SizeDimensionsCm> | null;
  itemName: string;
  onSelect: (product: CatalogProduct, optionId: string) => void;
  onSelectDimension: (product: CatalogProduct, axis: keyof SizeDimensionsCm, valueCm: number) => void;
  onChangeItemName: (product: CatalogProduct, name: string) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const money = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) ? `${getVatDisplayAmount(n, customerType).toLocaleString("nb-NO")} kr` : raw;
  };
  const weightOptions = product.options.filter((o) => o.active && o.category === SIZE_WEIGHT_CATEGORY);
  const volumeOptions = product.options.filter((o) => o.active && o.category === SIZE_VOLUME_CATEGORY);
  const hasVolume = volumeOptions.length > 0;

  const axes: Array<{ key: keyof SizeDimensionsCm; label: string }> = [
    { key: "widthCm", label: t("Width", "Bredde") },
    { key: "heightCm", label: t("Height", "Høyde") },
    { key: "lengthCm", label: t("Length", "Lengde") },
  ];

  const complete = isCompleteDimensions(dimensions);
  const volumeM3 = complete ? calculateVolumeM3(dimensions) : null;
  const volumeBracket = volumeOptions.find((o) => selectedIds.includes(o.id)) ?? null;
  const weightBracket = weightOptions.find((o) => selectedIds.includes(o.id)) ?? null;
  // All three chosen but no bracket fits: bigger than the top bracket.
  const tooLarge = complete && !volumeBracket;

  // The bracket that actually carries the charge — the higher of the two.
  const { chargeableId } = resolveSizeBracketCharge(product, selectedIds);
  const chargeable = chargeableId === volumeBracket?.id ? volumeBracket : weightBracket;
  const showCharge = !!volumeBracket && !!weightBracket && !!chargeable;
  const chargeBasis = chargeable === volumeBracket ? t("size", "størrelse") : t("weight", "vekt");

  return (
    <div className="flex flex-col gap-5 border-t border-black/10 pt-4">
      {/* This product is a catch-all, so the customer says what it is. */}
      <label className="block">
        <StepHeading
          step={1}
          title={t("What is it?", "Hva er det?")}
          hint={t("Write what the item is, so we know what to expect.", "Skriv hva varen er, så vi vet hva vi skal forvente.")}
        />
        <input
          type="text"
          value={itemName}
          maxLength={MAX_ITEM_NAME_LENGTH}
          onChange={(e) => onChangeItemName(product, sanitizeTextInput(e.target.value))}
          placeholder={t("e.g. grandfather clock, piano stool", "f.eks. bestefarsklokke, pianokrakk")}
          className="h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm text-black/85 outline-none transition focus:border-logoblue focus:ring-2 focus:ring-logoblue/20"
        />
      </label>

      {hasVolume && (
        <div>
          <StepHeading
            step={2}
            title={t("How big is it?", "Hvor stor er den?")}
            hint={t("Pick the closest size in centimetres — we work out the volume.", "Velg nærmeste mål i centimeter — vi beregner volumet.")}
          />
          <div className="flex flex-col gap-3 rounded-xl bg-black/[0.03] p-3">
            {axes.map((axis) => {
              const current = dimensions?.[axis.key] ?? null;
              return (
                <div key={axis.key} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-black/50">{axis.label}</span>
                  <div role="group" aria-label={`${axis.label} (cm)`} className="flex flex-wrap gap-1.5">
                    {SIZE_DIMENSION_CHOICES_CM.map((cm) => {
                      const selected = current === cm;
                      return (
                        <button
                          key={cm}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onSelectDimension(product, axis.key, cm)}
                          className={[
                            "h-9 min-w-11 rounded-lg border px-2 text-sm font-medium tabular-nums transition",
                            selected
                              ? "border-logoblue bg-logoblue text-white shadow-sm"
                              : "border-black/10 bg-white text-black/75 hover:border-logoblue/40 hover:text-black",
                          ].join(" ")}
                        >
                          {cm}
                        </button>
                      );
                    })}
                    <span className="self-center pl-1 text-xs text-black/40">cm</span>
                  </div>
                </div>
              );
            })}

            <div
              aria-live="polite"
              className={[
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
                tooLarge ? "border-red-200 bg-red-50" : "border-black/10 bg-white",
              ].join(" ")}
            >
              {volumeM3 === null ? (
                <span className="text-black/50">{t("Volume is calculated from the size.", "Volumet beregnes fra størrelsen.")}</span>
              ) : tooLarge ? (
                <span className="font-semibold text-red-600">
                  {t(
                    "Too large to book online — contact us for a quote.",
                    "For stor til å bestille på nett — kontakt oss for et tilbud.",
                  )}
                </span>
              ) : (
                <>
                  <span className="text-black/60">
                    {t("Volume", "Volum")}{" "}
                    <span className="font-semibold text-black/85">{Number(volumeM3.toFixed(3)).toLocaleString("nb-NO")} m³</span>
                    {volumeBracket && <span className="ml-1 text-black/50">· {optionLabel(locale, product, volumeBracket)}</span>}
                  </span>
                  {volumeBracket && (
                    <span className="whitespace-nowrap font-semibold text-black/70">{money(volumeBracket.customerPrice)}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {weightOptions.length > 0 && (
        <div>
          <StepHeading
            step={hasVolume ? 3 : 2}
            title={t("How heavy is it?", "Hvor tung er den?")}
            hint={t("Choose the bracket the item fits in.", "Velg vektklassen varen passer i.")}
          />
          <div role="group" aria-label={t("Weight", "Vekt")} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {weightOptions.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(product, option.id)}
                  className={[
                    "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition",
                    selected
                      ? "border-logoblue bg-logoblue/5 ring-2 ring-logoblue/20"
                      : "border-black/10 bg-white hover:border-logoblue/40",
                  ].join(" ")}
                >
                  <span className="text-sm font-semibold text-black/85">{optionLabel(locale, product, option)}</span>
                  <span className="text-xs font-medium text-black/55">{money(option.customerPrice)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* What the customer will be charged for this, once both are chosen. */}
      {showCharge && (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-logoblue/25 bg-logoblue/5 px-4 py-3"
        >
          <div>
            <div className="text-sm font-semibold text-black/85">{t("Added to delivery", "Legges til leveringen")}</div>
            <div className="text-xs text-black/55">{t(`Priced by ${chargeBasis} — the higher of the two.`, `Priset følger ${chargeBasis} — det høyeste av de to.`)}</div>
          </div>
          <div className="whitespace-nowrap text-lg font-bold text-logoblue">{money(chargeable.customerPrice)}</div>
        </div>
      )}
    </div>
  );
}
