"use client";

import { useEffect, useMemo, useState } from "react";
import { SteppedModal, RevealSection, type FinalStep, type StepSection } from "../SteppedModal";
import { WhiteGoodsProductCard } from "./WhiteGoodsProductCard";
import { WhiteGoodsProductGrid, productLabel } from "./WhiteGoodsProductGrid";
import { WebsiteListTiles } from "./WebsiteListTiles";
import { WhiteGoodsOrderSummary, type OrderSummaryProduct } from "./WhiteGoodsOrderSummary";
import { applyProductQuantity } from "./productQuantity";
import { previewCardDeliveryOptions } from "./deliveryPricePreview";
import { sortSummaryLines } from "./orderSummaryLines";
import { orderHasRequiredDelivery } from "./orderDeliveryRequirement";
import { categorizeWhiteGoodsLineCode } from "@/lib/content/whiteGoodsLineCategory";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import {
  type CatalogProduct,
  type CatalogSpecialOption,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { applyWhiteGoodsExtraUnitCharges } from "@/lib/booking/pricing/whiteGoodsExtraUnits";
import { applyWebsiteAssemblyExtras } from "@/lib/booking/pricing/websiteAssemblyExtras";
import { cardsForList, filterUnusedLists, isListConfigured, removeListCards, type WebsiteListInfo } from "./websiteLists";
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

  // The customer starts with any website price list (first step) and can add
  // the others afterwards ("any other products?"), in any order. `loadedProducts`
  // caches every list fetched so far; `chosenListCodes` are the ones on this
  // order (the first is the one they started with). Only chosen lists' products
  // are priced, all together by the one calculator.
  const [loadedProducts, setLoadedProducts] = useState<Record<string, CatalogProduct[]>>({});
  const [chosenListCodes, setChosenListCodes] = useState<string[]>([]);
  const [availableLists, setAvailableLists] = useState<WebsiteListInfo[]>([]);
  const [loadingListCode, setLoadingListCode] = useState<string | null>(null);
  const [addListError, setAddListError] = useState<string | null>(null);
  const firstListCode = chosenListCodes[0] ?? null;
  const catalogProducts = useMemo(
    () => chosenListCodes.flatMap((code) => loadedProducts[code] ?? []),
    [chosenListCodes, loadedProducts],
  );
  const [catalogSpecialOptions, setCatalogSpecialOptions] = useState<CatalogSpecialOption[]>([]);
  const [priceListSettings, setPriceListSettings] = useState<PriceListSettings>(
    createDefaultPriceListSettings(),
  );
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [productCards, setProductCards] = useState<SavedProductCard[]>([]);

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
        setLoadedProducts({ [json.priceListCode]: json.products });
        setAvailableLists(json.availableLists ?? []);
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

  // Fetches a list's products (once) and caches them. Returns false on failure.
  async function loadList(code: string): Promise<boolean> {
    if (loadedProducts[code]) return true;
    setLoadingListCode(code);
    setAddListError(null);
    try {
      const res = await fetch(`/api/site/white-goods-order/catalog?list=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.reason ?? "catalog fetch failed");
      setLoadedProducts((lists) => ({ ...lists, [code]: json.products }));
      return true;
    } catch {
      setAddListError(t("Could not load those products. Please try again.", "Kunne ikke laste produktene. Prøv igjen."));
      return false;
    } finally {
      setLoadingListCode(null);
    }
  }

  // "Any other products?": adds another list to the order.
  async function addList(code: string) {
    if (!(await loadList(code))) return;
    setChosenListCodes((codes) => (codes.includes(code) ? codes : [...codes, code]));
  }

  // First step: which list to start with. Changing it after products were
  // already picked starts the order over with the new list.
  async function selectStartList(code: string): Promise<boolean> {
    if (!(await loadList(code))) return false;
    if (chosenListCodes[0] !== code) {
      setProductCards([]);
      setChosenListCodes([code]);
    }
    return true;
  }

  // Takes an added list (and its products) back off the order. The starting
  // list can't be removed — pick a different one on the first step instead.
  function removeList(code: string) {
    const listProducts = loadedProducts[code] ?? [];
    setProductCards((cards) => removeListCards(cards, listProducts));
    setChosenListCodes((codes) => codes.filter((c) => c !== code));
  }

  const remainingLists = filterUnusedLists(availableLists, chosenListCodes);

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
    const breakdowns = applyWebsiteAssemblyExtras(
      applyWhiteGoodsExtraUnitCharges(
        buildProductBreakdowns(productCards, catalogProducts, catalogSpecialOptions),
        productCards,
        catalogProducts,
        catalogSpecialOptions,
      ),
      productCards,
      catalogProducts,
    );
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
        const lines = sortSummaryLines(
          (breakdown?.lines ?? []).map((line) => ({
            label: line.label,
            price: line.lineTotal,
            qty: line.qty,
            category: categorizeWhiteGoodsLineCode(line.code),
          })),
        );
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

  // Every card is auto-assigned a delivery type the moment it's added (see
  // applyProductQuantity), so this should never actually be false in
  // practice — kept as an explicit guard (rather than trusting that
  // invariant blindly) so a product can never slip through to submission
  // with no delivery charge at all.
  const hasConfiguredProduct = productCards.every((c) => !c.productId || c.deliveryType);
  const hasRequiredDelivery = orderHasRequiredDelivery(productCards);
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

  // Every list on the order gets its own "choose products" + "product options"
  // steps, in the order they were added; "any other products?" follows the
  // last one until every list is on the order. Steps reveal one after another,
  // so a newly added list's steps slot in ahead of the question and the
  // address/contact steps.
  const listSections: StepSection[] = chosenListCodes.flatMap((code, index) => {
    const info = availableLists.find((l) => l.code === code);
    const listProducts = loadedProducts[code] ?? [];
    const isLast = index === chosenListCodes.length - 1;
    const suffix = index > 0 && info ? ` — ${t(info.labelEn, info.labelNo)}` : "";

    const productsStep: StepSection = {
      id: `products-${code}`,
      title: t("Choose products", "Velg produkter") + suffix,
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col gap-4">
          {catalogLoading && (
            <p className="text-sm text-black/60">{t("Loading products…", "Laster produkter…")}</p>
          )}
          {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}

          <WhiteGoodsProductGrid
            locale={locale}
            products={listProducts}
            quantities={quantitiesByProductId}
            onChangeQuantity={setProductQuantity}
          />

          {index > 0 && (
            <button
              type="button"
              onClick={() => removeList(code)}
              className="self-center text-sm font-semibold text-logoblue transition hover:opacity-70"
            >
              {t("Not needed — remove this category", "Trengs ikke — fjern denne kategorien")}
            </button>
          )}

          <AutoAdvance
            ready={cardsForList(productCards, listProducts).length > 0}
            onReady={onComplete}
            onRetract={onUncomplete}
          />
        </div>
      ),
    };

    const optionsStep: StepSection = {
      id: `product-options-${code}`,
      title: t("Product options", "Produktvalg") + suffix,
      render: ({ onComplete, onUncomplete }) => (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          <div className="flex flex-col gap-4">
            {cardsForList(productCards, listProducts).map((card) => {
              const product = listProducts.find((p) => p.id === card.productId);
              if (!product) return null;
              return (
                <RevealSection key={card.cardId}>
                  <WhiteGoodsProductCard
                    locale={locale}
                    product={product}
                    value={card}
                    deliveryPreview={previewCardDeliveryOptions(productCards, catalogProducts, card.cardId)}
                    onChange={(next) => updateCard(card.cardId, next)}
                    onQuantityChange={(amount) => setProductQuantity(product.id, amount)}
                  />
                </RevealSection>
              );
            })}
            {isLast && productCards.length > 0 && hasConfiguredProduct && !hasRequiredDelivery && (
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
                {t(
                  "At least one item needs delivery (doorstep or carry-in) — installation only isn't enough on its own.",
                  "Minst én vare må ha levering (til ytterdør eller med innbæring) — kun montering er ikke nok alene.",
                )}
              </p>
            )}
            <AutoAdvance
              ready={isListConfigured(productCards, listProducts) && (!isLast || hasRequiredDelivery)}
              onReady={onComplete}
              onRetract={onUncomplete}
            />
          </div>

          {/* Every options step keeps its own calculator. It is sticky within
              its step, so scrolling past one step hands over to the next
              step's calculator instead of the column disappearing. */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <WhiteGoodsOrderSummary
              locale={locale}
              products={summaryProducts}
              totalIncVat={pricing.totals.totalIncVat}
            />
          </div>
        </div>
      ),
    };

    return [productsStep, optionsStep];
  });

  const moreSections: StepSection[] =
    chosenListCodes.length > 0 && remainingLists.length > 0
      ? [
          {
            id: "more-products",
            title: t("Any other products you need added?", "Trenger du å legge til andre produkter?"),
            description: t(
              "Pick another category — everything ends up in the same order.",
              "Velg en annen kategori — alt havner i samme bestilling.",
            ),
            render: ({ onComplete }) => (
              <div className="flex flex-col items-center gap-3">
                <WebsiteListTiles
                  locale={locale}
                  lists={remainingLists}
                  selectedCode={null}
                  loadingCode={loadingListCode}
                  onPick={(code) => addList(code)}
                />
                {addListError && <p className="text-xs text-red-600">{addListError}</p>}
                <button
                  type="button"
                  onClick={onComplete}
                  className="text-sm font-semibold text-logoblue transition hover:opacity-70"
                >
                  {t("No, that's all", "Nei, det er alt")}
                </button>
              </div>
            ),
          },
        ]
      : [];

  const sections: StepSection[] = [
    {
      id: "pickup-category",
      title: t("What are we picking up?", "Hva skal vi hente?"),
      render: ({ onComplete }) => (
        <div className="flex flex-col items-center gap-2">
          {catalogLoading && <p className="text-sm text-black/60">{t("Loading…", "Laster…")}</p>}
          {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}
          <WebsiteListTiles
            locale={locale}
            lists={availableLists}
            selectedCode={firstListCode}
            loadingCode={loadingListCode}
            onPick={async (code) => {
              if (await selectStartList(code)) onComplete();
            }}
          />
          {addListError && <p className="text-xs text-red-600">{addListError}</p>}
        </div>
      ),
    },
    ...listSections,
    ...moreSections,
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
