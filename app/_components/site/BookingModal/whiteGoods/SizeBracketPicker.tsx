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
  calculateVolumeM3,
  getVolumeBracketLimitsM3,
  isCompleteDimensions,
  type SizeDimensionsCm,
} from "@/lib/booking/pricing/sizeDimensions";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { websiteCustomerPrice, type CustomerType } from "@/lib/booking/pricing/websiteVat";
import { sanitizeTextInput } from "@/lib/orders/websiteOrderValidation";
// The card's own numbered heading, so these questions continue its sections
// (Delivery, Installation, Additional services) at the same size.
import { SectionHeader } from "./WhiteGoodsProductCard";
import { DimensionRuler } from "./DimensionRuler";

function optionLabel(locale: Locale, product: CatalogProduct, option: CatalogOption) {
  const seed = findWebsiteProductSeed(product.code)?.options.find((o) => o.code === option.code);
  if (!seed) return option.label;
  return locale === "no" ? seed.labelNo : seed.labelEn;
}


// What a size-priced product asks for once it is selected: what the item is, its
// width / height / length (5–300 cm in 5 cm steps, on a ruler or typed — the volume is calculated from them,
// the customer never picks a volume) and its weight bracket. Over 1.5 m³ or
// over 50 kg it's delivered as a large item (websiteSizeTier.ts), which the
// summary at the bottom says.
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
  firstStep = 1,
  embedded = false,
}: {
  locale: Locale;
  // Private customers see prices incl. VAT (what they actually pay);
  // business customers see ex-VAT (what they reclaim) — see
  // websiteCustomerPrice (prices are stored ex. VAT).
  customerType: CustomerType;
  product: CatalogProduct;
  selectedIds: string[];
  dimensions: Partial<SizeDimensionsCm> | null;
  itemName: string;
  onSelect: (product: CatalogProduct, optionId: string) => void;
  onSelectDimension: (product: CatalogProduct, axis: keyof SizeDimensionsCm, valueCm: number) => void;
  onChangeItemName: (product: CatalogProduct, name: string) => void;
  // Inside another card's numbered sections (the admin editor): carry on its
  // step numbers, without this picker's own top border.
  firstStep?: number;
  embedded?: boolean;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const money = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) ? `${websiteCustomerPrice(n, customerType).toLocaleString("nb-NO")} kr` : raw;
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
  // The volume meter's scale: where small ends, and the most bookable online.
  const volumeLimits = getVolumeBracketLimitsM3(product);
  const maxM3 = volumeLimits.at(-1) ?? null;
  const smallLimitM3 = volumeLimits.length > 1 ? volumeLimits[0] : null;
  const m3 = (value: number) => Number(value.toFixed(3)).toLocaleString("nb-NO");

  // Over 1.5 m³ or over 50 kg — either one — it's delivered as a large item
  // (websiteSizeTier.ts); the delivery options above show what that costs.
  const isLarge = [volumeBracket, weightBracket].some((o) => o?.weightClass === "HEAVY");
  // A bracket is only charged on top if staff give it a price (0 kr as seeded).
  const { chargeableId } = resolveSizeBracketCharge(product, selectedIds);
  const chargeable = chargeableId === volumeBracket?.id ? volumeBracket : weightBracket;
  const surcharge = chargeable && Number(chargeable.customerPrice) > 0 ? chargeable : null;
  const showTier = !!volumeBracket && !!weightBracket;
  const priced = (option: { customerPrice: string }) => Number(option.customerPrice) > 0;

  return (
    // Embedded, each question is one of the card's own sections: same heading,
    // same dividing line and spacing as Delivery / Additional services.
    <div
      className={
        embedded
          ? "flex flex-col divide-y divide-black/10 *:py-5 *:first:pt-0 *:last:pb-0"
          : "flex flex-col gap-5 border-t border-black/10 pt-4"
      }
    >
      {/* This product is a catch-all, so the customer says what it is. */}
      <div>
        <SectionHeader
          step={firstStep}
          title={t("What is it?", "Hva er det?")}
          subtitle={t("Write what the item is, so we know what to expect.", "Skriv hva varen er, så vi vet hva vi skal forvente.")}
        />
        <input
          type="text"
          aria-label={t("What is it?", "Hva er det?")}
          value={itemName}
          maxLength={MAX_ITEM_NAME_LENGTH}
          onChange={(e) => onChangeItemName(product, sanitizeTextInput(e.target.value))}
          placeholder={t("e.g. grandfather clock, piano stool", "f.eks. bestefarsklokke, pianokrakk")}
          className="h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm text-black/85 outline-none transition focus:border-logoblue focus:ring-2 focus:ring-logoblue/20"
        />
      </div>

      {hasVolume && (
        <div>
          <SectionHeader
            step={firstStep + 1}
            title={t("How big is it?", "Hvor stor er den?")}
            subtitle={t(
              "Drag each line to the size in centimetres, or type it in the box — we work out the volume.",
              "Dra hver linje til målet i centimeter, eller skriv det i boksen — vi beregner volumet.",
            )}
          />
          <div className="flex flex-col gap-3">
            {axes.map((axis) => (
              <DimensionRuler
                key={axis.key}
                label={axis.label}
                valueCm={dimensions?.[axis.key] ?? null}
                onChange={(cm) => onSelectDimension(product, axis.key, cm)}
              />
            ))}

            {/* Volume meter: fills up to the most bookable online, with a
                mark where a small item ends. */}
            <div
              aria-live="polite"
              className={[
                "rounded-lg border px-3 py-2.5 text-sm",
                tooLarge ? "border-red-200 bg-red-50" : "border-black/10 bg-white",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-black/60">
                  {t("Volume", "Volum")}{" "}
                  <span className={["font-semibold tabular-nums", tooLarge ? "text-red-600" : "text-black/85"].join(" ")}>
                    {volumeM3 === null ? "–" : m3(volumeM3)} m³
                  </span>
                  {volumeBracket && (
                    <span className="ml-1 text-black/50">
                      · {volumeBracket.weightClass === "HEAVY" ? t("large item", "stor vare") : t("small item", "liten vare")}
                    </span>
                  )}
                </span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  {volumeBracket && priced(volumeBracket) && (
                    <span className="font-semibold text-black/70">{money(volumeBracket.customerPrice)}</span>
                  )}
                  {maxM3 !== null && <span className="text-xs text-black/45">{t("max", "maks")} {m3(maxM3)} m³</span>}
                </span>
              </div>

              {maxM3 !== null && (
                <div aria-hidden className="relative mt-2.5 mb-4">
                  <div className="h-2 overflow-hidden rounded-full bg-black/10">
                    <div
                      className={[
                        "h-full rounded-full transition-[width] duration-300",
                        tooLarge ? "bg-red-500" : volumeBracket?.weightClass === "HEAVY" ? "bg-logoblue" : "bg-logoblue/60",
                      ].join(" ")}
                      style={{ width: `${Math.min(1, (volumeM3 ?? 0) / maxM3) * 100}%` }}
                    />
                  </div>
                  {smallLimitM3 !== null && (
                    <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(smallLimitM3 / maxM3) * 100}%` }}>
                      <span className="-mt-0.5 h-3 w-0.5 rounded-full bg-black/35" />
                      <span className="mt-0.5 whitespace-nowrap text-[10px] leading-none text-black/40">{m3(smallLimitM3)} m³</span>
                    </div>
                  )}
                </div>
              )}

              {tooLarge && (
                <p className="font-semibold text-red-600">
                  {t(
                    "Too large to book online — contact us for a quote.",
                    "For stor til å bestille på nett — kontakt oss for et tilbud.",
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {weightOptions.length > 0 && (
        <div>
          <SectionHeader
            step={firstStep + (hasVolume ? 2 : 1)}
            title={t("How heavy is it?", "Hvor tung er den?")}
            subtitle={t("Choose the bracket the item fits in.", "Velg vektklassen varen passer i.")}
          />
          <div role="group" aria-label={t("Weight", "Vekt")} className="grid grid-cols-2 gap-2">
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
                  {priced(option) && <span className="text-xs font-medium text-black/55">{money(option.customerPrice)}</span>}
                </button>
              );
            })}
          </div>

          {/* Small or large item, once both are chosen — part of the last
              question, not a section of its own. */}
          {showTier && (
            <div
              aria-live="polite"
              className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-logoblue/25 bg-logoblue/5 px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-black/85">
                  {isLarge ? t("Delivered as a large item", "Leveres som stor vare") : t("Delivered as a small item", "Leveres som liten vare")}
                </div>
                <div className="text-xs text-black/55">
                  {t(
                    "Over 1.5 m³ or over 50 kg counts as a large item.",
                    "Over 1,5 m³ eller over 50 kg regnes som stor vare.",
                  )}
                </div>
              </div>
              {surcharge && <div className="whitespace-nowrap text-lg font-bold text-logoblue">+{money(surcharge.customerPrice)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
