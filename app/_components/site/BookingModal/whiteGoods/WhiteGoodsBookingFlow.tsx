"use client";

import { useEffect, useMemo, useState } from "react";
import { SteppedModal, AnimatedStack, type FinalStep, type StepSection } from "../SteppedModal";
import { WhiteGoodsProductCard } from "./WhiteGoodsProductCard";
import { CustomerTypeStep } from "./CustomerTypeStep";
import { PickupSourceStep, pickupAddressPlaceholder, type PickupSource } from "./PickupSourceStep";
import { PickupContactCard, isPickupContactStepReady, type PickupProductPoolSection } from "./PickupContactCard";
import { ExtraPickupLocationCard } from "./ExtraPickupLocationCard";
import {
  claimedCardIds,
  groupByCategory,
  hasEnteredOrderOrContactDetails,
  isPickupLocationReady,
  nextPickupLocationId,
  orderedCardIds,
  poolsForLocations,
  remainingAfterClaim,
  routeStopsForDistance,
  syncPickupLocations,
  type PickupLocationState,
} from "./pickupLocations";
import { ContactDetailsCard } from "./ContactDetailsCard";
import { WhiteGoodsProductGrid, productLabel } from "./WhiteGoodsProductGrid";
import { WebsiteListTiles } from "./WebsiteListTiles";
import {
  WhiteGoodsOrderSummary,
  type OrderSummaryExtraLine,
  type OrderSummaryProduct,
} from "./WhiteGoodsOrderSummary";
import {
  getVatBreakdown,
  getVatDisplayAmount,
  getVatDisplayTotal,
  type CustomerType,
} from "@/lib/booking/pricing/vatDisplayTotal";
import {
  addAnotherProductCard,
  applyProductQuantity,
  getProductQuantities,
  nextCardId,
  removeProductCard,
} from "./productQuantity";
import { getCalculatorProductName } from "./productDisplayName";
import {
  applyItemName,
  applySizeBracketSelection,
  applySizeDimension,
  getSelectedSizeOptionIds,
  getSizeDimensions,
} from "./sizeBracketSelection";
import { previewCardDeliveryOptions } from "./deliveryPricePreview";
import { sortSummaryLines } from "./orderSummaryLines";
import { orderHasRequiredDelivery } from "./orderDeliveryRequirement";
import { categorizeWhiteGoodsLineCode } from "@/lib/content/whiteGoodsLineCategory";
import { OrderDetailsCard } from "./OrderDetailsCard";
import { isOrderDetailsStepReady } from "./orderDetailsReady";
import { isValidEmail } from "@/lib/orders/websiteOrderValidation";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import {
  type CatalogProduct,
  type CatalogSpecialOption,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { applyWhiteGoodsExtraUnitCharges } from "@/lib/booking/pricing/whiteGoodsExtraUnits";
import { applyWebsiteAssemblyExtras } from "@/lib/booking/pricing/websiteAssemblyExtras";
import {
  cardsForList,
  filterUnusedLists,
  highlightedStartList,
  isListOptionsStepReady,
  isProductsStepReady,
  removeListCards,
  type WebsiteListInfo,
} from "./websiteLists";
import { buildWhiteGoodsCalculatorBreakdowns } from "@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns";
import { parsePriceSetting } from "@/lib/booking/pricing/orderCalculatorExtras";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import {
  findCardsWithSizeBracketProblems,
  findSizePricedCardsMissingName,
  isSizePricedProduct,
} from "@/lib/booking/pricing/sizeBrackets";
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
  // Lists that have had at least one product. An emptied one (its only product
  // unticked while another list still has products) must not hold back the
  // steps after it — see isProductsStepReady.
  const [populatedListCodes, setPopulatedListCodes] = useState<string[]>([]);
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

  useEffect(() => {
    setPopulatedListCodes((codes) => {
      const next = chosenListCodes.filter(
        (code) => codes.includes(code) || cardsForList(productCards, loadedProducts[code] ?? []).length > 0,
      );
      return next.length === codes.length && next.every((code, i) => code === codes[i]) ? codes : next;
    });
  }, [productCards, chosenListCodes, loadedProducts]);

  const [pickupAddress, setPickupAddressRaw] = useState("");
  const [deliveryAddress, setDeliveryAddressRaw] = useState("");
  // Whether the current address text was actually picked from the Mapbox
  // suggestions (vs. free-typed and never confirmed) — reset to false on
  // every keystroke by AddressAutocompleteInput's own onChange. Gates the
  // driving-distance lookup below so an unconfirmed address never quietly
  // gets geocoded and priced.
  const [pickupAddressSelected, setPickupAddressSelected] = useState(false);
  const [deliveryAddressSelected, setDeliveryAddressSelected] = useState(false);
  const setPickupAddress = (value: string, wasSelected?: boolean) => {
    setPickupAddressRaw(value);
    setPickupAddressSelected(Boolean(wasSelected));
  };
  const setDeliveryAddress = (value: string, wasSelected?: boolean) => {
    setDeliveryAddressRaw(value);
    setDeliveryAddressSelected(Boolean(wasSelected));
  };
  // Floors count from 1 (ground floor); null until the customer picks one —
  // both are required (see floorValue.ts). Sent as 0 when never asked (a
  // store pickup), same as before.
  const [pickupFloor, setPickupFloor] = useState<number | null>(null);
  const [deliveryFloor, setDeliveryFloor] = useState<number | null>(null);
  // Tracked separately — the pickup and delivery locations aren't
  // necessarily the same kind of building.
  const [pickupLiftAvailable, setPickupLiftAvailable] = useState(false);
  const [deliveryLiftAvailable, setDeliveryLiftAvailable] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  // Not user-editable — calculated from the pickup/delivery addresses below
  // (see the effect near the address state), same as the legacy ServiceModal did.
  const [drivingDistance, setDrivingDistance] = useState("");
  const [drivingDistanceLoading, setDrivingDistanceLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);
  // Set once by the very first step ("customer-type", below) — no toggle
  // to change it again later, since asking twice would be redundant. Still
  // display-only — decides which VAT total (incl. or ex.) is shown as the
  // headline number vs. the smaller secondary one, never affects actual
  // pricing. Starts `null` (unanswered) rather than defaulting to "private"
  // so the first step's tiles open with neither one highlighted —
  // getVatDisplayTotal already treats "private" as its own default
  // whenever this is null.
  const [customerType, setCustomerType] = useState<CustomerType | null>(null);
  // Who the pickup address belongs to (store / private individual /
  // business) — asked right before the address fields it gives context to.
  // Informational for staff/drivers, not used in pricing.
  const [pickupSource, setPickupSource] = useState<PickupSource | null>(null);
  // The store/business name and a contact person — which of these apply
  // depends on pickupSource (see PickupContactCard).
  const [pickupPlaceName, setPickupPlaceName] = useState("");
  const [pickupContactName, setPickupContactName] = useState("");
  const [pickupContactPhone, setPickupContactPhone] = useState("");
  // Unchecking this asks which product CARDS come from THIS address
  // (selected below) — whatever's left over gets asked about again, as its
  // own pickup location, until every card has a home. See pickupLocations.ts
  // for the shared logic behind that chain. Assignment is per card, not per
  // product, so a product split into several cards (addAnotherProductCard)
  // can be picked up from different places, same as the "#1"/"#2" split the
  // order summary already shows for them.
  const [allProductsPickedUpHere, setAllProductsPickedUpHere] = useState(true);
  const [pickupCardIds, setPickupCardIds] = useState<number[]>([]);
  const [extraPickupLocations, setExtraPickupLocations] = useState<PickupLocationState[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{ orderNumber: string } | null>(null);

  // Every card on the order — the pool the first pickup location's
  // checklist offers, before any of it gets claimed.
  const poolCardIds = useMemo(() => orderedCardIds(productCards), [productCards]);
  const location0Claimed = useMemo(
    () => claimedCardIds(poolCardIds, allProductsPickedUpHere, pickupCardIds),
    [poolCardIds, allProductsPickedUpHere, pickupCardIds],
  );
  const location0Remaining = useMemo(
    () => remainingAfterClaim(poolCardIds, location0Claimed),
    [poolCardIds, location0Claimed],
  );

  // Grows/trims extraPickupLocations to match how many are actually needed
  // right now, keeping every kept entry's typed-in fields (see
  // syncPickupLocations) — same "recompute derived state, only update if it
  // actually changed" shape as populatedListCodes above.
  useEffect(() => {
    setExtraPickupLocations((locations) => {
      const next = syncPickupLocations(locations, location0Remaining, () => nextPickupLocationId(locations));
      return next.length === locations.length && next.every((loc, i) => loc === locations[i]) ? locations : next;
    });
  }, [location0Remaining]);

  const { pools: extraPickupPools, finalRemaining: unassignedCardIds } = useMemo(
    () => poolsForLocations(extraPickupLocations, location0Remaining),
    [extraPickupLocations, location0Remaining],
  );

  function updateExtraPickupLocation(id: number, patch: Partial<PickupLocationState>) {
    setExtraPickupLocations((locations) => locations.map((loc) => (loc.id === id ? { ...loc, ...patch } : loc)));
  }

  // Which website list (category) a product belongs to — used to group the
  // pickup checklists by category once the order spans more than one list.
  const listCodeByProductId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const code of chosenListCodes) {
      for (const product of loadedProducts[code] ?? []) map[product.id] = code;
    }
    return map;
  }, [chosenListCodes, loadedProducts]);

  function categoryLabel(code: string): string {
    const info = availableLists.find((l) => l.code === code);
    return info ? t(info.labelEn, info.labelNo) : t("Other", "Annet");
  }

  // A card's display name for the pickup checklists — the same "#1"/"#2"
  // sibling numbering and item-name-first rule (Other furniture) the order
  // summary uses, plus the card's own quantity when it's more than one.
  function pickupChecklistName(cardId: number): string {
    const card = productCards.find((c) => c.cardId === cardId);
    const product = card?.productId ? catalogProducts.find((p) => p.id === card.productId) : undefined;
    if (!card || !product) return String(cardId);
    const baseName = getCalculatorProductName({ product, itemName: card.modelNumber, label: productLabel(locale, product) });
    const siblings = productCards.filter((c) => c.productId === card.productId);
    const name = siblings.length > 1 ? `${baseName} #${siblings.indexOf(card) + 1}` : baseName;
    return card.amount > 1 ? `${name} (×${card.amount})` : name;
  }

  function pickupChecklistChoice(cardId: number) {
    const card = productCards.find((c) => c.cardId === cardId);
    const product = card?.productId ? catalogProducts.find((p) => p.id === card.productId) : undefined;
    return { cardId, name: pickupChecklistName(cardId), code: product?.code ?? "", iconKey: product?.iconKey ?? null };
  }

  // Groups a location's offered pool into checklist sections by category —
  // only actually labeled once the order spans more than one website list,
  // otherwise it's one flat, unlabeled section.
  function pickupPoolSections(pool: number[]): PickupProductPoolSection[] {
    const grouped = groupByCategory(pool, (cardId) => {
      const card = productCards.find((c) => c.cardId === cardId);
      return (card?.productId && listCodeByProductId[card.productId]) || "";
    });
    const showLabels = chosenListCodes.length > 1 && grouped.length > 1;
    return grouped.map(({ category, items }) => ({
      label: showLabels ? categoryLabel(category) : null,
      items: items.map(pickupChecklistChoice),
    }));
  }

  const allPickupLocationsReady =
    isPickupContactStepReady({
      pickupSource,
      pickupPlaceName,
      pickupAddress,
      pickupAddressSelected,
      pickupFloor,
      pickupContactName,
      pickupContactPhone,
    }) &&
    (poolCardIds.length <= 1 || allProductsPickedUpHere || pickupCardIds.length > 0) &&
    extraPickupLocations.every((loc, i) => isPickupLocationReady(loc, extraPickupPools[i] ?? [])) &&
    unassignedCardIds.length === 0;

  // Driving distance is never typed by the customer — it's calculated via
  // Mapbox along pickup 1 → every extra pickup location → delivery, once all
  // of those are filled in AND actually picked from the suggestions (same
  // debounced pattern the old ServiceModal used). A free-typed address that
  // was never selected must not silently get geocoded and priced.
  const routeStops = routeStopsForDistance({
    pickupAddress,
    pickupAddressSelected,
    extraLocations: extraPickupLocations,
    deliveryAddress,
    deliveryAddressSelected,
  });
  // A stable key for the effect below — extraPickupLocations gets a new
  // identity on every keystroke in any of its fields, not just address ones.
  const routeStopsKey = routeStops ? JSON.stringify(routeStops) : "";

  useEffect(() => {
    if (!routeStopsKey) {
      setDrivingDistance("");
      setDrivingDistanceLoading(false);
      return;
    }

    const controller = new AbortController();
    setDrivingDistanceLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/site/route-distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: routeStopsKey,
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && typeof data.distanceKm === "string") {
          setDrivingDistance(data.distanceKm);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setDrivingDistanceLoading(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [routeStopsKey]);

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

  // The start list shown on the first step: the first chosen list that still
  // has products (emptying white goods while furniture remains makes furniture
  // the start).
  const firstListCode = highlightedStartList(chosenListCodes, productCards, loadedProducts);

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
    if (firstListCode !== code) {
      setProductCards([]);
      setChosenListCodes([code]);
      setPopulatedListCodes([]);
    }
    return true;
  }

  // Takes an added list (and its products) back off the order. The starting
  // list can't be removed — pick a different one on the first step instead.
  function removeList(code: string) {
    const listProducts = loadedProducts[code] ?? [];
    setProductCards((cards) => removeListCards(cards, listProducts));
    setChosenListCodes((codes) => codes.filter((c) => c !== code));
    setPopulatedListCodes((codes) => codes.filter((c) => c !== code));
  }

  const remainingLists = filterUnusedLists(availableLists, chosenListCodes);

  function updateCard(cardId: number, next: SavedProductCard) {
    setProductCards((cards) => cards.map((c) => (c.cardId === cardId ? next : c)));
  }
  function setProductQuantity(productId: string, amount: number) {
    setProductCards((cards) => applyProductQuantity(cards, productId, amount, nextCardId(cards)));
  }
  // Volume / weight for size-priced products (Other furniture), chosen in the
  // product tile itself.
  function selectSizeBracket(product: CatalogProduct, optionId: string) {
    setProductCards((cards) => applySizeBracketSelection(cards, product, optionId));
  }
  // What the size-priced item is (Other furniture), in the customer's words.
  function changeItemName(product: CatalogProduct, name: string) {
    setProductCards((cards) => applyItemName(cards, product, name));
  }
  // Width / height / length: the volume bracket is calculated from them.
  function selectSizeDimension(product: CatalogProduct, axis: "widthCm" | "heightCm" | "lengthCm", valueCm: number) {
    setProductCards((cards) => applySizeDimension(cards, product, axis, valueCm));
  }

  function addAnotherCard(productId: string) {
    setProductCards((cards) => addAnotherProductCard(cards, productId, nextCardId(cards)));
  }
  function removeCard(cardId: number) {
    setProductCards((cards) => removeProductCard(cards, cardId));
  }

  const quantitiesByProductId = useMemo(() => getProductQuantities(productCards), [productCards]);

  const normalizedSettings = useMemo(
    () => normalizePriceListSettings(priceListSettings),
    [priceListSettings],
  );

  // A store pickup never asks for a pickup floor/lift (see the order-details
  // step) — treated as ground floor with a lift, same as the server does.
  const isStorePickup = pickupSource === "store";
  const effectivePickupFloor = isStorePickup ? 0 : (pickupFloor ?? 0);
  const effectiveDeliveryFloor = deliveryFloor ?? 0;
  const effectivePickupLiftAvailable = isStorePickup ? true : pickupLiftAvailable;

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
      // Not offered as a client-selectable option in this flow — always off.
      expressDelivery: false,
      extraPickups: [],
      pickupFloor: effectivePickupFloor,
      deliveryFloor: effectiveDeliveryFloor,
      pickupLiftAvailable: effectivePickupLiftAvailable,
      deliveryLiftAvailable,
    });
    const priceLookup = buildPriceLookup(catalogProducts, catalogSpecialOptions, { locale });
    return calculateBookingPricing({ productBreakdowns: fullBreakdowns, priceLookup });
  }, [
    productCards,
    locale,
    catalogProducts,
    catalogSpecialOptions,
    normalizedSettings,
    drivingDistance,
    effectivePickupFloor,
    effectiveDeliveryFloor,
    effectivePickupLiftAvailable,
    deliveryLiftAvailable,
  ]);

  // pricing.totals.totalExVat is the sum of the raw, unmodified line prices
  // — which, per the shared catalog convention, IS the client (VAT-inclusive)
  // total. Its engine-internal name doesn't change here; only how the
  // website displays it does.
  const finalVatDisplay = getVatDisplayTotal({
    total: pricing.totals.totalExVat,
    customerType: customerType ?? undefined,
  });
  const finalVatBreakdown = getVatBreakdown(pricing.totals.totalExVat);

  // Charges not tied to a specific product card (floor surcharge,
  // long-distance delivery, …) — see buildWhiteGoodsCalculatorBreakdowns.
  const orderExtraLines: OrderSummaryExtraLine[] = useMemo(() => {
    const extrasBreakdown = pricing.breakdowns.find((b) => b.isOrderExtras);
    return (extrasBreakdown?.lines ?? []).map((line) => ({
      label: line.label,
      price: line.lineTotal,
      qty: line.qty,
    }));
  }, [pricing]);

  // Converted here (rather than in FloorLiftField) since this is the one
  // place in the tree that already holds customerType — the badge itself
  // just renders whatever amount it's given.
  const floorSurchargePerFloor = getVatDisplayAmount(
    parsePriceSetting(normalizedSettings.floorSurcharge.price),
    customerType ?? "private",
  );

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
        const siblings = productCards.filter((c) => c.productId === card.productId);
        const baseName = getCalculatorProductName({
          product,
          itemName: card.modelNumber,
          label: productLabel(locale, product),
        });
        return {
          cardId: card.cardId,
          // Other furniture is titled with the customer's own name ("A.M: Fish").
          // A product split into several cards is numbered so they can be told apart.
          name: siblings.length > 1 ? `${baseName} #${siblings.indexOf(card) + 1}` : baseName,
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
  // Size-priced products (Other furniture) also need a volume and a weight
  // bracket chosen — the server rejects an order without them.
  const sizeBracketsComplete =
    findCardsWithSizeBracketProblems(productCards, catalogProducts).length === 0 &&
    findSizePricedCardsMissingName(productCards, catalogProducts).length === 0;
  const hasRequiredDelivery = orderHasRequiredDelivery(productCards);
  // Pickup address is required earlier, in the pickup-contact step.
  const canContinueOrderDetails = isOrderDetailsStepReady({
    deliveryAddress,
    deliveryAddressSelected,
    deliveryFloor,
    preferredDate,
    timeWindow,
  });
  // Email is mandatory: the order-received confirmation and the payment link
  // are emailed, so an order without one could never be completed.
  const emailValid = isValidEmail(email);
  // Reaching (and staying on) the final review step also needs every
  // pickup location's own required fields and product split resolved — see
  // the pickup-contact step's AutoAdvance for why this isn't gated any
  // earlier: order-details/contact must not disappear just because the
  // customer went back and split the pickup across more locations.
  const canContinueContact = !!name.trim() && !!phone.trim() && emailValid && allPickupLocationsReady;
  const canSubmit =
    name.trim() &&
    phone.trim() &&
    emailValid &&
    sizeBracketsComplete &&
    allPickupLocationsReady &&
    canContinueOrderDetails &&
    !submitLoading;

  async function handleSubmit() {
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/site/white-goods-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCards,
          pickupSource,
          pickupPlaceName,
          pickupContactName,
          pickupContactPhone,
          pickupAddress,
          deliveryAddress,
          pickupFloor: pickupFloor ?? 0,
          deliveryFloor: effectiveDeliveryFloor,
          pickupLiftAvailable,
          deliveryLiftAvailable,
          drivingDistance,
          preferredDate,
          timeWindow,
          name,
          phone,
          email,
          notes,
          // Only present once the order was actually split across more than
          // one pickup address — omitted for the common single-location
          // case so that payload stays exactly as it always has been.
          ...(!allProductsPickedUpHere && poolCardIds.length > 1
            ? { pickupProductNames: location0Claimed.map(pickupChecklistName) }
            : {}),
          ...(extraPickupLocations.length > 0
            ? {
                extraPickupLocations: extraPickupLocations.map((loc, i) => ({
                  source: loc.source,
                  placeName: loc.placeName,
                  address: loc.address,
                  floor: loc.floor ?? 0,
                  liftAvailable: loc.liftAvailable,
                  contactName: loc.contactName,
                  contactPhone: loc.contactPhone,
                  productNames: claimedCardIds(extraPickupPools[i] ?? [], loc.allRemainingHere, loc.selectedCardIds).map(
                    pickupChecklistName,
                  ),
                })),
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setSubmitError(
          t("Something went wrong. Please check your details and try again.", "Noe gikk galt. Sjekk opplysningene og prøv igjen."),
        );
        return;
      }
      setSubmitResult({ orderNumber: json.orderNumber ?? String(json.displayId) });
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
            customerType={customerType ?? "private"}
            products={listProducts}
            quantities={quantitiesByProductId}
            onChangeQuantity={setProductQuantity}
            sizeSelections={Object.fromEntries(listProducts.map((p) => [p.id, getSelectedSizeOptionIds(productCards, p)]))}
            onSelectSizeBracket={selectSizeBracket}
            sizeDimensions={Object.fromEntries(listProducts.map((p) => [p.id, getSizeDimensions(productCards, p)]))}
            onSelectSizeDimension={selectSizeDimension}
            itemNames={Object.fromEntries(
              listProducts.map((p) => [p.id, productCards.find((c) => c.productId === p.id)?.modelNumber ?? ""]),
            )}
            onChangeItemName={changeItemName}
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
            ready={isProductsStepReady({
              ownCount: cardsForList(productCards, listProducts).length,
              orderCount: productCards.length,
              wasPopulated: populatedListCodes.includes(code),
              // Other furniture: this step only finishes once its tile has a
              // name, a size and a weight, then moves on to the options.
              sizeBracketsComplete:
                findCardsWithSizeBracketProblems(cardsForList(productCards, listProducts), listProducts).length === 0 &&
                findSizePricedCardsMissingName(cardsForList(productCards, listProducts), listProducts).length === 0,
            })}
            onReady={onComplete}
            onRetract={onUncomplete}
          />
        </div>
      ),
    };

    const optionsStep: StepSection = {
      id: `product-options-${code}`,
      title: t("Product options", "Produktvalg") + suffix,
      // Nothing to configure once every product of the list is unticked.
      hidden: cardsForList(productCards, listProducts).length === 0,
      render: ({ onComplete, onUncomplete }) => (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          <div className="flex flex-col gap-4">
            <AnimatedStack
              gap={16}
              items={cardsForList(productCards, listProducts).flatMap((card) => {
                const product = listProducts.find((p) => p.id === card.productId);
                if (!product) return [];
                // Cards of one product sit next to each other (see
                // addAnotherProductCard). Size-priced products (Other furniture)
                // are configured in their grid tile, one per product, so they
                // can't be split.
                const siblings = productCards.filter((c) => c.productId === card.productId);
                const isSplit = siblings.length > 1;
                const isLastOfProduct = siblings.at(-1)?.cardId === card.cardId;
                return [
                  {
                    key: String(card.cardId),
                    node: (
                      <WhiteGoodsProductCard
                        locale={locale}
                        customerType={customerType ?? "private"}
                        product={product}
                        value={card}
                        deliveryPreview={previewCardDeliveryOptions(productCards, catalogProducts, card.cardId)}
                        onChange={(next) => updateCard(card.cardId, next)}
                        variantNumber={isSplit ? siblings.indexOf(card) + 1 : undefined}
                        onRemove={isSplit ? () => removeCard(card.cardId) : undefined}
                        onAddAnother={
                          isLastOfProduct && !isSizePricedProduct(product)
                            ? () => addAnotherCard(product.id)
                            : undefined
                        }
                      />
                    ),
                  },
                ];
              })}
            />
            {isLast && productCards.length > 0 && hasConfiguredProduct && !hasRequiredDelivery && (
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
                {t(
                  "At least one item needs delivery (doorstep or carry-in) — installation only isn't enough on its own.",
                  "Minst én vare må ha levering (til ytterdør eller med innbæring) — kun montering er ikke nok alene.",
                )}
              </p>
            )}
            <AutoAdvance
              ready={isListOptionsStepReady({
                cards: productCards,
                listProducts,
                wasPopulated: populatedListCodes.includes(code),
                isLast,
                hasRequiredDelivery,
              })}
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
              orderExtras={orderExtraLines}
              total={pricing.totals.totalExVat}
              customerType={customerType ?? "private"}
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
            render: ({ onComplete, onUncomplete }) => (
              <div className="flex flex-col items-center gap-3">
                <WebsiteListTiles
                  locale={locale}
                  lists={remainingLists}
                  selectedCode={null}
                  loadingCode={loadingListCode}
                  onPick={(code) => addList(code)}
                />
                {addListError && <p className="text-xs text-red-600">{addListError}</p>}
                {/* Nothing to answer: the steps after this one simply appear below,
                    like every other step, and adding a category is optional. */}
                <AutoAdvance ready onReady={onComplete} onRetract={onUncomplete} />
              </div>
            ),
          },
        ]
      : [];

  const sections: StepSection[] = [
    {
      id: "customer-type",
      title: t("Are you ordering as a private person or a business?", "Bestiller du som privatperson eller bedrift?"),
      render: ({ onComplete }) => (
        <CustomerTypeStep
          locale={locale}
          value={customerType}
          onPick={(next) => {
            setCustomerType(next);
            onComplete();
          }}
        />
      ),
    },
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
      id: "pickup-source",
      title: t("Where are we picking up from?", "Hvor henter vi fra?"),
      // Retracted (e.g. another category was added ahead of it): un-pick the
      // tile so it doesn't read as answered when it shows again. Everything
      // typed into the pickup/order/contact steps stays in state, so picking
      // a tile again brings it all back (and auto-advances through it).
      onRetract: () => setPickupSource(null),
      render: ({ onComplete }) => (
        <PickupSourceStep
          locale={locale}
          value={pickupSource}
          onPick={(next) => {
            setPickupSource(next);
            onComplete();
          }}
        />
      ),
    },
    {
      id: "pickup-contact",
      title: t("Pickup contact", "Kontakt ved henting"),
      render: ({ onComplete, onUncomplete }) =>
        pickupSource ? (
          <div className="flex flex-col gap-4">
            <PickupContactCard
              locale={locale}
              bookingLocale={bookingLocale}
              pickupSource={pickupSource}
              pickupPlaceName={pickupPlaceName}
              setPickupPlaceName={setPickupPlaceName}
              pickupAddress={pickupAddress}
              setPickupAddress={setPickupAddress}
              pickupAddressSelected={pickupAddressSelected}
              pickupAddressPlaceholder={pickupAddressPlaceholder(locale, pickupSource)}
              pickupFloor={pickupFloor}
              setPickupFloor={setPickupFloor}
              pickupLiftAvailable={pickupLiftAvailable}
              setPickupLiftAvailable={setPickupLiftAvailable}
              pickupContactName={pickupContactName}
              setPickupContactName={setPickupContactName}
              pickupContactPhone={pickupContactPhone}
              setPickupContactPhone={setPickupContactPhone}
              productPoolSections={poolCardIds.length > 1 ? pickupPoolSections(poolCardIds) : undefined}
              allRemainingHere={allProductsPickedUpHere}
              setAllRemainingHere={setAllProductsPickedUpHere}
              selectedCardIds={pickupCardIds}
              setSelectedCardIds={setPickupCardIds}
              allRemainingLabel={t("All products are picked up here", "Alle varene hentes her")}
            />

            <AnimatedStack
              gap={16}
              items={extraPickupLocations.map((location, i) => ({
                key: String(location.id),
                node: (
                  <ExtraPickupLocationCard
                    locale={locale}
                    bookingLocale={bookingLocale}
                    index={i}
                    location={location}
                    productPoolSections={pickupPoolSections(extraPickupPools[i] ?? [])}
                    onChange={(patch) => updateExtraPickupLocation(location.id, patch)}
                  />
                ),
              }))}
            />

            <AutoAdvance
              ready={allPickupLocationsReady}
              onReady={onComplete}
              // Once order-details/contact already have something in them,
              // splitting the pickup across more locations must not yank
              // them off screen — only suppresses the retraction, doesn't
              // skip anything: canContinueContact below still blocks
              // reaching the final step until every location resolves again.
              onRetract={() => {
                if (
                  !hasEnteredOrderOrContactDetails({
                    deliveryAddress,
                    preferredDate,
                    timeWindow,
                    name,
                    phone,
                    email,
                    notes,
                  })
                ) {
                  onUncomplete();
                }
              }}
            />
          </div>
        ) : null,
    },
    {
      id: "order-details",
      title: t("Order details", "Ordredetaljer"),
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col gap-4">
          <OrderDetailsCard
            locale={locale}
            bookingLocale={bookingLocale}
            deliveryAddress={deliveryAddress}
            setDeliveryAddress={setDeliveryAddress}
            deliveryAddressSelected={deliveryAddressSelected}
            deliveryFloor={deliveryFloor}
            setDeliveryFloor={setDeliveryFloor}
            deliveryLiftAvailable={deliveryLiftAvailable}
            setDeliveryLiftAvailable={setDeliveryLiftAvailable}
            preferredDate={preferredDate}
            setPreferredDate={setPreferredDate}
            timeWindow={timeWindow}
            setTimeWindow={setTimeWindow}
            drivingDistance={drivingDistance}
            drivingDistanceLoading={drivingDistanceLoading}
            floorSurchargePerFloor={floorSurchargePerFloor}
          />

          <AutoAdvance ready={canContinueOrderDetails} onReady={onComplete} onRetract={onUncomplete} />
        </div>
      ),
    },
    {
      id: "contact",
      title: t("Your details", "Dine opplysninger"),
      render: ({ onComplete, onUncomplete }) => (
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
              `Order #${submitResult.orderNumber} is pending approval. We'll email you a payment link once it's confirmed.`,
              `Bestilling #${submitResult.orderNumber} venter på godkjenning. Vi sender deg en betalingslenke på e-post når den er bekreftet.`,
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
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
              {t("Summary", "Oppsummering")}
            </h4>
            <div className="mt-3 flex flex-col gap-1 text-sm">
              <div
                className={`flex justify-between ${
                  finalVatDisplay.primary === "exVat" ? "font-semibold" : ""
                }`}
              >
                <span>{t("Subtotal (ex. VAT)", "Delsum (eks. mva)")}</span>
                <span>{finalVatBreakdown.exVat.toLocaleString("nb-NO")} kr</span>
              </div>
              <div className="flex justify-between">
                <span>{t("VAT (25%)", "MVA (25%)")}</span>
                <span>{finalVatBreakdown.vat.toLocaleString("nb-NO")} kr</span>
              </div>
              <div
                className={`flex justify-between ${
                  finalVatDisplay.primary === "incVat" ? "font-semibold" : ""
                }`}
              >
                <span>{t("Total incl. VAT", "Totalt inkl. MVA")}</span>
                <span>{finalVatBreakdown.incVat.toLocaleString("nb-NO")} kr</span>
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
