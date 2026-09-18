"use client";

import { useEffect, useMemo, useState } from "react";
import { SteppedModal, RevealSection, type FinalStep, type StepSection } from "../SteppedModal";
import { WhiteGoodsProductCard } from "./WhiteGoodsProductCard";
import { WhiteGoodsProductGrid, productLabel } from "./WhiteGoodsProductGrid";
import { WhiteGoodsOrderSummary, type OrderSummaryProduct } from "./WhiteGoodsOrderSummary";
import { applyProductQuantity } from "./productQuantity";
import { categorizeWhiteGoodsLineCode } from "@/lib/content/whiteGoodsLineCategory";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import {
  type CatalogProduct,
  type CatalogSpecialOption,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildWhiteGoodsCalculatorBreakdowns } from "@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import {
  createDefaultPriceListSettings,
  normalizePriceListSettings,
  type PriceListSettings,
} from "@/lib/products/priceListSettings";
import type { Locale } from "@/lib/content/ServiceWindowContent";

type Props = {
  locale: Locale;
  onClose: () => void;
};

const toBookingLocale = (l: Locale): BookingUiLocale => (l === "no" ? "nb" : "en");

function nextCardId(cards: SavedProductCard[]) {
  return (cards.at(-1)?.cardId ?? -1) + 1;
}

// Only one category is wired up so far — a real catalog/pricing flow for
// the others (furniture, pallets, ...) doesn't exist yet. Still shown as
// its own required first step so the UI already matches the eventual
// multi-category picker without a rework once those are added.
const PICKUP_CATEGORIES = [
  { id: "WHITE_GOODS", labelEn: "White goods / electronics", labelNo: "Hvitevarer / elektronikk" },
] as const;

type PickupCategoryId = (typeof PICKUP_CATEGORIES)[number]["id"];

// Renders nothing — just watches `ready` and advances the section the
// moment it flips true, so no section needs its own bottom "Continue"
// button. If `ready` later flips back to false (e.g. the user un-picks the
// product that had satisfied it), retracts any sections revealed after
// this one instead of leaving them stranded ahead of an unsatisfied step.
// `onReady`/`onRetract` (SteppedModal's onComplete/onUncomplete) are new
// function identities every render; only the `ready` transition should
// re-trigger this.
function AutoAdvance({
  ready,
  onReady,
  onRetract,
}: {
  ready: boolean;
  onReady: () => void;
  onRetract: () => void;
}) {
  useEffect(() => {
    if (ready) onReady();
    else onRetract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}

export function WhiteGoodsBookingFlow({ locale, onClose }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const bookingLocale = toBookingLocale(locale);

  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogSpecialOptions, setCatalogSpecialOptions] = useState<CatalogSpecialOption[]>([]);
  const [priceListSettings, setPriceListSettings] = useState<PriceListSettings>(
    createDefaultPriceListSettings(),
  );
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [productCards, setProductCards] = useState<SavedProductCard[]>([]);
  const [pickupCategory, setPickupCategory] = useState<PickupCategoryId | null>(null);

  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupFloor, setPickupFloor] = useState(0);
  const [deliveryFloor, setDeliveryFloor] = useState(0);
  const [liftAvailable, setLiftAvailable] = useState(false);
  const [expressDelivery, setExpressDelivery] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [drivingDistance, setDrivingDistance] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{ displayId: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/site/white-goods-order/catalog");
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) throw new Error(json.reason ?? "catalog fetch failed");
        setCatalogProducts(json.products);
        setCatalogSpecialOptions(json.specialOptions);
        setPriceListSettings(json.priceListSettings);
      } catch {
        if (!cancelled) {
          setCatalogError(t("Could not load products. Please try again.", "Kunne ikke laste produkter. Prøv igjen."));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateCard(cardId: number, next: SavedProductCard) {
    setProductCards((cards) => cards.map((c) => (c.cardId === cardId ? next : c)));
  }
  function setProductQuantity(productId: string, amount: number) {
    setProductCards((cards) => applyProductQuantity(cards, productId, amount, nextCardId(cards)));
  }

  const quantitiesByProductId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const card of productCards) {
      if (card.productId) map[card.productId] = card.amount;
    }
    return map;
  }, [productCards]);

  const normalizedSettings = useMemo(
    () => normalizePriceListSettings(priceListSettings),
    [priceListSettings],
  );

  const pricing = useMemo(() => {
    const breakdowns = buildProductBreakdowns(productCards, catalogProducts, catalogSpecialOptions);
    const fullBreakdowns = buildWhiteGoodsCalculatorBreakdowns({
      productBreakdowns: breakdowns,
      priceListSettings: normalizedSettings,
      drivingDistance,
      expressDelivery,
      extraPickups: [],
      pickupFloor,
      deliveryFloor,
      liftAvailable,
    });
    const priceLookup = buildPriceLookup(catalogProducts, catalogSpecialOptions);
    return calculateBookingPricing({ productBreakdowns: fullBreakdowns, priceLookup });
  }, [
    productCards,
    catalogProducts,
    catalogSpecialOptions,
    normalizedSettings,
    drivingDistance,
    expressDelivery,
    pickupFloor,
    deliveryFloor,
    liftAvailable,
  ]);

  const summaryProducts: OrderSummaryProduct[] = useMemo(() => {
    return productCards
      .map((card) => {
        const product = catalogProducts.find((p) => p.id === card.productId);
        if (!product) return null;
        const breakdown = pricing.breakdowns.find((b) => b.cardId === card.cardId);
        const lines = (breakdown?.lines ?? []).map((line) => ({
          label: line.label,
          price: line.lineTotal,
          category: categorizeWhiteGoodsLineCode(line.code),
        }));
        return {
          cardId: card.cardId,
          name: productLabel(locale, product),
          code: product.code,
          iconKey: product.iconKey ?? null,
          qty: card.amount,
          total: lines.reduce((sum, line) => sum + line.price, 0),
          lines,
        };
      })
      .filter((p): p is OrderSummaryProduct => p !== null);
  }, [productCards, catalogProducts, pricing, locale]);

  const canContinueProducts = productCards.some((c) => c.productId && c.deliveryType);
  const canContinueOrderDetails = !!pickupAddress.trim() && !!deliveryAddress.trim();
  const canContinueContact = !!name.trim() && !!phone.trim();
  const canSubmit = name.trim() && phone.trim() && !submitLoading;

  async function handleSubmit() {
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/site/white-goods-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCards,
          pickupAddress,
          deliveryAddress,
          pickupFloor,
          deliveryFloor,
          liftAvailable,
          expressDelivery,
          drivingDistance,
          preferredDate,
          timeWindow,
          name,
          phone,
          email,
          notes,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setSubmitError(
          t("Something went wrong. Please check your details and try again.", "Noe gikk galt. Sjekk opplysningene og prøv igjen."),
        );
        return;
      }
      setSubmitResult({ displayId: json.displayId });
    } catch {
      setSubmitError(t("Something went wrong. Please try again.", "Noe gikk galt. Prøv igjen."));
    } finally {
      setSubmitLoading(false);
    }
  }

  const sections: StepSection[] = [
    {
      id: "pickup-category",
      title: t("What are we picking up?", "Hva skal vi hente?"),
      render: ({ onComplete }) => (
        <div className="flex flex-wrap justify-center gap-2">
          {PICKUP_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setPickupCategory(category.id);
                onComplete();
              }}
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                pickupCategory === category.id
                  ? "border-logoblue bg-logoblue text-white"
                  : "border-black/15 text-black/70 hover:border-logoblue/50",
              ].join(" ")}
            >
              {t(category.labelEn, category.labelNo)}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "products",
      title: t("Choose products", "Velg produkter"),
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col gap-4">
          {catalogLoading && (
            <p className="text-sm text-black/60">{t("Loading products…", "Laster produkter…")}</p>
          )}
          {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}

          <WhiteGoodsProductGrid
            locale={locale}
            products={catalogProducts}
            quantities={quantitiesByProductId}
            onChangeQuantity={setProductQuantity}
          />

          <AutoAdvance ready={productCards.length > 0} onReady={onComplete} onRetract={onUncomplete} />
        </div>
      ),
    },
    {
      id: "product-options",
      title: t("Product options", "Produktvalg"),
      render: ({ onComplete, onUncomplete }) => (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-4">
            {productCards.map((card) => {
              const product = catalogProducts.find((p) => p.id === card.productId);
              if (!product) return null;
              return (
                <RevealSection key={card.cardId}>
                  <WhiteGoodsProductCard
                    locale={locale}
                    product={product}
                    value={card}
                    onChange={(next) => updateCard(card.cardId, next)}
                    onRemove={() => setProductQuantity(product.id, 0)}
                  />
                </RevealSection>
              );
            })}
            <AutoAdvance ready={canContinueProducts} onReady={onComplete} onRetract={onUncomplete} />
          </div>

          <div className="lg:sticky lg:top-0 lg:self-start">
            <WhiteGoodsOrderSummary
              locale={locale}
              products={summaryProducts}
              totalIncVat={pricing.totals.totalIncVat}
            />
          </div>
        </div>
      ),
    },
    {
      id: "order-details",
      title: t("Order details", "Ordredetaljer"),
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/50">
              {t("Pickup address", "Hentested")}
            </label>
            <AddressAutocompleteInput
              value={pickupAddress}
              onChange={(v) => setPickupAddress(v)}
              locale={bookingLocale}
              placeholder={t("Store or delivery point", "Butikk eller hentested")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/50">
              {t("Delivery address", "Leveringsadresse")}
            </label>
            <AddressAutocompleteInput
              value={deliveryAddress}
              onChange={(v) => setDeliveryAddress(v)}
              locale={bookingLocale}
              placeholder={t("Your address", "Din adresse")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("Pickup floor", "Etasje ved henting")}
              <input
                type="number"
                min={0}
                value={pickupFloor}
                onChange={(e) => setPickupFloor(Math.max(0, Number(e.target.value) || 0))}
                className="h-10 rounded-lg border border-black/15 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("Delivery floor", "Etasje ved levering")}
              <input
                type="number"
                min={0}
                value={deliveryFloor}
                onChange={(e) => setDeliveryFloor(Math.max(0, Number(e.target.value) || 0))}
                className="h-10 rounded-lg border border-black/15 px-2"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={liftAvailable}
              onChange={(e) => setLiftAvailable(e.target.checked)}
            />
            {t("Lift available", "Heis tilgjengelig")}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={expressDelivery}
              onChange={(e) => setExpressDelivery(e.target.checked)}
            />
            {t("Express delivery (under 24h)", "Ekspresslevering (under 24t)")}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("Requested date", "Ønsket dato")}
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="h-10 rounded-lg border border-black/15 px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("Time window", "Tidsvindu")}
              <input
                type="text"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                placeholder={t("e.g. 08:00–12:00", "f.eks. 08:00–12:00")}
                className="h-10 rounded-lg border border-black/15 px-2"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            {t("Driving distance from our depot (km, optional)", "Kjøreavstand fra vårt lager (km, valgfritt)")}
            <input
              type="text"
              value={drivingDistance}
              onChange={(e) => setDrivingDistance(e.target.value)}
              className="h-10 rounded-lg border border-black/15 px-2"
            />
          </label>

          <AutoAdvance ready={canContinueOrderDetails} onReady={onComplete} onRetract={onUncomplete} />
        </div>
      ),
    },
    {
      id: "contact",
      title: t("Your details", "Dine opplysninger"),
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            {t("Name / company", "Navn / firma")}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-lg border border-black/15 px-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("Phone", "Telefon")}
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 rounded-lg border border-black/15 px-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("Email", "E-post")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-lg border border-black/15 px-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("Additional information", "Tilleggsinformasjon")}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-lg border border-black/15 px-2 py-1.5"
            />
          </label>

          <AutoAdvance ready={canContinueContact} onReady={onComplete} onRetract={onUncomplete} />
        </div>
      ),
    },
  ];

  const finalStep: FinalStep = {
    render: ({ onBack }) =>
      submitResult ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <h4 className="text-lg font-semibold text-logoblue">
            {t("Order received!", "Bestilling mottatt!")}
          </h4>
          <p className="text-sm text-black/60">
            {t(
              `Order #${submitResult.displayId} is pending approval. We'll email you a payment link once it's confirmed.`,
              `Bestilling #${submitResult.displayId} venter på godkjenning. Vi sender deg en betalingslenke på e-post når den er bekreftet.`,
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-sm font-semibold text-logoblue transition hover:opacity-70"
          >
            <span aria-hidden="true">←</span>
            {t("Back", "Tilbake")}
          </button>

          <div>
            <h4 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
              {t("Summary", "Oppsummering")}
            </h4>
            <div className="mt-3 flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span>{t("Subtotal", "Delsum")}</span>
                <span>{pricing.totals.subtotalExVat.toLocaleString("nb-NO")} kr</span>
              </div>
              <div className="flex justify-between">
                <span>{t("VAT (25%)", "MVA (25%)")}</span>
                <span>{pricing.totals.vat.toLocaleString("nb-NO")} kr</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t("Total incl. VAT", "Totalt inkl. MVA")}</span>
                <span>{pricing.totals.totalIncVat.toLocaleString("nb-NO")} kr</span>
              </div>
            </div>
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="self-start inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {submitLoading ? t("Sending…", "Sender…") : t("Submit order", "Send bestilling")}
          </button>
        </div>
      ),
  };

  return <SteppedModal sections={sections} finalStep={finalStep} onClose={onClose} />;
}
