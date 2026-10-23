"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SteppedModal, AnimatedStack, type FinalStep, type StepSection } from "../SteppedModal";
import { AutoAdvance } from "../AutoAdvance";
import { WhiteGoodsProductCard } from "./WhiteGoodsProductCard";
import { SizeBracketPicker } from "./SizeBracketPicker";
import { CustomerTypeStep } from "./CustomerTypeStep";
import { PickupSourceStep, pickupAddressPlaceholder, type PickupSource } from "./PickupSourceStep";
import { PickupContactCard, isPickupContactStepReady, type PickupProductPoolSection } from "./PickupContactCard";
import { ExtraPickupLocationCard } from "./ExtraPickupLocationCard";
import {
  collectPickupDocuments,
  hasEveryStorePickupDocument,
  planPickupDocumentUploads,
  type PickupDocumentUpload,
} from "./pickupDocumentUploads";
import {
  claimedCardIds,
  groupByCategory,
  hasEnteredOrderOrContactDetails,
  isPickupLocationReady,
  keepsLaterStepsOnPickupRetract,
  nextPickupLocationId,
  patchPickupLocation,
  extraPickupsForPricing,
  orderedCardIds,
  poolsForLocations,
  remainingAfterClaim,
  routeStopsForDistance,
  syncPickupLocations,
  type PickupLocationState,
} from "./pickupLocations";
import { adminDetailsFromFlow, pickupStateFromStops } from "./adminOrderState";
import CustomerOrderEditFooter from "@/app/_components/site/pageComponents/myOrder/CustomerOrderEditFooter";
import { findCardsWithoutPickup, findPickupsWithoutProducts } from "@/lib/orders/pickupAssignment";
import { withPickupContacts, type CustomerEditDraft } from "@/app/_components/site/pageComponents/myOrder/customerEditPayload";
import type { AdminOrderDetails } from "@/lib/orders/websiteOrderDetailsEdit";
import type { WebsiteOrderHandling } from "@/lib/orders/websiteOrderHandling";
import { ContactDetailsCard } from "./ContactDetailsCard";
import { buildOrderReviewBlocks, type ReviewInput } from "./orderReview";
import { OrderReviewBlocks, ReviewTotalFooter } from "./OrderReviewParts";
import { hasAddableServices } from "./bookedServices";
import { PickupContactPersonsCard, type PickupContactPerson } from "./PickupContactPersonsCard";
import { WhiteGoodsProductGrid, productLabel } from "./WhiteGoodsProductGrid";
import { WebsiteListTiles } from "./WebsiteListTiles";
import {
  WhiteGoodsOrderSummary,
  type OrderSummaryExtraLine,
  type OrderSummaryProduct,
} from "./WhiteGoodsOrderSummary";
import {
  websiteCustomerPrice,
  websiteCustomerTotalDisplay,
  websiteCustomerTotals,
  type CustomerType,
} from "@/lib/booking/pricing/websiteVat";
import {
  addAnotherProductCard,
  applyProductQuantity,
  getProductQuantities,
  nextCardId,
  removeProductCard,
} from "./productQuantity";
import { getCalculatorProductName, getSummaryProductTitle } from "./productDisplayName";
import { localizeWebsiteLineLabel } from "@/lib/content/websiteLineLabels";
import {
  applyItemName,
  applySizeBracketSelection,
  applySizeDimension,
  getSelectedSizeOptionIds,
  getSizeDimensions,
} from "./sizeBracketSelection";
import { previewCardDeliveryOptions } from "./deliveryPricePreview";
import { buildOrderAdjustmentLines, sortSummaryLines } from "./orderSummaryLines";
import { categorizeWhiteGoodsLineCode } from "@/lib/content/whiteGoodsLineCategory";
import { OrderDetailsCard } from "./OrderDetailsCard";
import { isOrderDetailsStepReady } from "./orderDetailsReady";
import { isValidEmail, isValidOrgNumber } from "@/lib/orders/websiteOrderValidation";
import { MAX_PICKUP_DOCUMENT_SIZE_MB } from "@/lib/orders/pickupDocuments";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import {
  type CatalogProduct,
  type CatalogSpecialOption,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { priceWebsiteOrder } from "@/lib/booking/pricing/priceWebsiteOrder";
import {
  cardsForList,
  filterUnusedLists,
  highlightedStartList,
  isListOptionsStepComplete,
  isListOptionsStepReady,
  isProductsStepReady,
  moreProductsHostCode,
  removeListCards,
  type WebsiteListInfo,
} from "./websiteLists";
import { parsePriceSetting } from "@/lib/booking/pricing/orderCalculatorExtras";
import {
  findCardsWithSizeBracketProblems,
  findSizePricedCardsMissingName,
  isSizePricedProduct,
} from "@/lib/booking/pricing/sizeBrackets";
import { findOtherManufacturerCardsMissingName } from "@/lib/booking/otherManufacturer";
import {
  createDefaultPriceListSettings,
  normalizePriceListSettings,
  type PriceListSettings,
} from "@/lib/products/priceListSettings";
import type { Locale } from "@/lib/content/ServiceWindowContent";

// The same flow, opened by the customer on their own order in "My order"
// (app/(site)/[locale]/min-bestilling): prefilled from GET
// /api/customer/orders/[orderNumber], saved through its PUT. Within 24h of
// the time window (`beforeCutoff` false) only the product options (delivery
// type, add-ons) and the contact details stay open — see
// lib/orders/customerOrderEditPolicy.ts, which the server enforces.
export type WhiteGoodsCustomerEdit = {
  orderNumber: string;
  beforeCutoff: boolean;
  onSaved: (message: string) => void;
};

type Props = {
  locale: Locale;
  onClose: () => void;
  customer?: WhiteGoodsCustomerEdit;
};


const toBookingLocale = (l: Locale): BookingUiLocale => (l === "no" ? "nb" : "en");

export function WhiteGoodsBookingFlow({ locale, onClose, customer }: Props) {
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
  // "No, continue" answered on "any other products?" — holds back the steps
  // after it until then. Asked again after a category is added.
  const [declinedMoreProducts, setDeclinedMoreProducts] = useState(false);
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
  // Only asked when ordering as a business (with the company name in `name`).
  const [orgNumber, setOrgNumber] = useState("");
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
  // websiteCustomerTotalDisplay already treats "private" as its own default
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
  // Required store receipt / order confirmation for the first pickup (extra
  // stops keep theirs on PickupLocationState.document). Uploaded on submit
  // under one token; what was already sent survives a failed submit so a
  // retry doesn't upload it twice (see pickupDocumentUploads.ts).
  const [pickupDocument, setPickupDocument] = useState<File | null>(null);
  const pickupDocumentTokenRef = useRef<string | null>(null);
  const sentPickupDocumentsRef = useRef<PickupDocumentUpload[]>([]);
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

  // Admin editing: the order loaded into the fields above, and what it was
  // compared with its payments when opened.
  const [adminReady, setAdminReady] = useState(false);
  const [adminLoadError, setAdminLoadError] = useState(false);
  // The order's express / discount / extra / deviation (set in the modal's
  // "Handle order" panel, not here) — included in the live price.
  const [adminHandling, setAdminHandling] = useState<WebsiteOrderHandling | null>(null);
  // The km rule for the order being edited (old orders keep the old one), as
  // the server prices it. A customer's new order always uses the new rule.
  const [adminUseFullKm, setAdminUseFullKm] = useState(true);
  // The route as loaded — the distance is only looked up again once a stop
  // actually changes, so opening and saving never re-prices by itself.
  const adminInitialRouteKey = useRef<string | null>(null);
  // Customer editing: the order as loaded, to send only what they changed.
  const [customerInitialDraft, setCustomerInitialDraft] = useState<CustomerEditDraft | null>(null);
  // Before the cutoff the changes are reviewed on the summary page (the
  // final step) before saving; the edit bar below saves from there.
  const [customerSummaryOpen, setCustomerSummaryOpen] = useState(false);
  // Within 24h of the job: only contact details (incl. pickup contact
  // persons) and added services — the "late change" sections below.
  const customerLocked = !!customer && !customer.beforeCutoff;
  // The stops exactly as the server sent them: within 24h only their contact
  // persons are changed and sent (withPickupContacts).
  const customerLoadedPickups = useRef<unknown[] | null>(null);
  // Each product card as booked — within 24h its services can only be added to.
  const bookedCards = useMemo(
    () => new Map(((customerInitialDraft?.productCards ?? []) as SavedProductCard[]).map((card) => [card.cardId, card])),
    [customerInitialDraft],
  );

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
    setExtraPickupLocations((locations) => patchPickupLocation(locations, id, patch, location0Remaining));
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

  const firstPickupReady = isPickupContactStepReady({
    pickupSource,
    pickupPlaceName,
    pickupAddress,
    pickupAddressSelected,
    pickupFloor,
    pickupContactName,
    pickupContactPhone,
  }) && (!!customer || hasEveryStorePickupDocument([{ source: pickupSource, document: pickupDocument }]));
  // A store stop isn't done until its pickup document is picked (new orders
  // only — the admin/customer editors never upload one).
  const extraPickupDocumentsReady =
    !!customer ||
    hasEveryStorePickupDocument(extraPickupLocations.map((loc) => ({ source: loc.source, document: loc.document ?? null })));
  const allPickupLocationsReady =
    firstPickupReady &&
    extraPickupDocumentsReady &&
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
  // An existing order being edited (the customer's own, in "My order").
  const isAdmin = !!customer;

  useEffect(() => {
    if (isAdmin && adminInitialRouteKey.current === null) return;
    // An admin's order keeps its stored distance until a stop changes (and
    // when an edited address hasn't been picked from the suggestions yet).
    if (isAdmin && (routeStopsKey === adminInitialRouteKey.current || !routeStopsKey)) {
      setDrivingDistanceLoading(false);
      return;
    }
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
  }, [routeStopsKey, isAdmin]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/site/white-goods-order/catalog");
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) throw new Error(json.reason ?? "catalog fetch failed");
        setLoadedProducts((lists) => ({ ...lists, [json.priceListCode]: lists[json.priceListCode] ?? json.products }));
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

  // Admin / customer editing: put a loaded order into the flow's own state.
  function loadOrderIntoFlow(loaded: {
    products: CatalogProduct[];
    categories: { code: string; productIds: string[] }[];
    cards: SavedProductCard[];
    details: AdminOrderDetails;
    drivingDistance: string | null;
  }) {
    const { products, categories, cards, details } = loaded;
    const lists: Record<string, CatalogProduct[]> = {};
    for (const category of categories) {
      lists[category.code] = category.productIds.flatMap((id) => products.find((p) => p.id === id) ?? []);
    }
    const onOrder = new Set(cards.map((card) => card.productId));
    setLoadedProducts((current) => ({ ...current, ...lists }));
    setChosenListCodes(categories.filter((c) => c.productIds.some((id) => onOrder.has(id))).map((c) => c.code));
    setProductCards(cards);

    setCustomerType(details.customer.customerType);
    setName(details.customer.name);
    setOrgNumber(details.customer.orgNumber ?? "");
    setPhone(details.customer.phone);
    setEmail(details.customer.email);
    setNotes(details.customer.comments);

    const [first] = details.pickups;
    setPickupSource(first?.source ?? null);
    setPickupPlaceName(first?.placeName ?? "");
    setPickupAddress(first?.address ?? "", !!first?.address);
    setPickupFloor(first?.floor ?? null);
    setPickupLiftAvailable(first?.liftAvailable ?? false);
    setPickupContactName(first?.contactName ?? "");
    setPickupContactPhone(first?.contactPhone ?? "");

    // Which products each stop collects — the names stored at booking
    // are the Norwegian checklist names (the site's default language).
    const nameOf = (cardId: number) => {
      const card = cards.find((c) => c.cardId === cardId);
      const product = card?.productId ? products.find((p) => p.id === card.productId) : undefined;
      if (!card || !product) return "";
      const base = getCalculatorProductName({ product, itemName: card.modelNumber, label: productLabel("no", product) });
      const siblings = cards.filter((c) => c.productId === card.productId);
      return siblings.length > 1 ? `${base} #${siblings.indexOf(card) + 1}` : base;
    };
    const pickupState = pickupStateFromStops({ cards, stops: details.pickups, nameOf });
    setAllProductsPickedUpHere(pickupState.allProductsPickedUpHere);
    setPickupCardIds(pickupState.pickupCardIds);
    setExtraPickupLocations(pickupState.extraLocations);

    setDeliveryAddress(details.delivery.address, !!details.delivery.address);
    setDeliveryFloor(details.delivery.floor);
    setDeliveryLiftAvailable(details.delivery.liftAvailable);
    setPreferredDate(details.preferredDate);
    setTimeWindow(details.timeWindow);
    setDrivingDistance(loaded.drivingDistance ?? "");
    adminInitialRouteKey.current = JSON.stringify(
      routeStopsForDistance({
        pickupAddress: first?.address ?? "",
        pickupAddressSelected: !!first?.address,
        extraLocations: pickupState.extraLocations,
        deliveryAddress: details.delivery.address,
        deliveryAddressSelected: !!details.delivery.address,
      }) ?? "",
    );
  }

  // Customer ("My order"): load their order into the flow's own state.
  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customer/orders/${encodeURIComponent(customer.orderNumber)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        if (!json?.ok || json.details?.kind !== "catalog" || !json.catalog) throw new Error(json?.reason ?? "load failed");
        customerLoadedPickups.current = Array.isArray(json.details.pickups) ? json.details.pickups : [];
        loadOrderIntoFlow({
          products: json.catalog.products,
          categories: json.categories,
          cards: json.productCards,
          details: json.details,
          drivingDistance: json.drivingDistance,
        });
        // Staff-set parts of the price (discount, extra, deviation, express),
        // so the live summary matches what the server will charge.
        const context = json.pricingContext;
        setAdminHandling({
          driver: "",
          secondDriver: "",
          driverInfo: "",
          licensePlate: "",
          description: "",
          deliveryDate: "",
          timeWindow: "",
          subcontractorMinus: "",
          subcontractorPlus: "",
          expressDelivery: context?.expressDelivery === true,
          rabatt: context?.rabatt ?? "",
          leggTil: context?.leggTil ?? "",
          deviation: context?.deviation ?? "",
          customDeviation: {
            price: context?.customDeviation?.price ?? null,
            subcontractorPrice: null,
            description: context?.customDeviation?.description ?? null,
          },
        });
        setAdminUseFullKm(context?.useFullDistanceKmPricing !== false);
        setAdminReady(true);
      } catch {
        if (!cancelled) setAdminLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.orderNumber]);

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
    setDeclinedMoreProducts(false);
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
    const deliveryTypes = catalogProducts.find((p) => p.id === productId)?.deliveryTypes;
    setProductCards((cards) => applyProductQuantity(cards, productId, amount, nextCardId(cards), deliveryTypes));
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
    const deliveryTypes = catalogProducts.find((p) => p.id === productId)?.deliveryTypes;
    setProductCards((cards) => addAnotherProductCard(cards, productId, nextCardId(cards), deliveryTypes));
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
  // Same rule for every extra stop (mirrors extraPickupFloorsForPricing on
  // the server).
  const extraPickupFloors = useMemo(
    () =>
      extraPickupLocations.map((loc) =>
        loc.source === "store"
          ? { floor: 0, liftAvailable: true }
          : { floor: loc.floor ?? 0, liftAvailable: loc.liftAvailable },
      ),
    [extraPickupLocations],
  );

  // The one shared pricing (priceWebsiteOrder) — the server prices the order
  // with exactly the same function and refuses it if the totals differ, so
  // this number is what gets stored and charged.
  const pricing = useMemo(() => {
    return priceWebsiteOrder({
      cards: productCards,
      catalogProducts,
      catalogSpecialOptions,
      priceListSettings: normalizedSettings,
      drivingDistance,
      // Not offered to customers — only an admin editing an order may have it.
      expressDelivery: adminHandling?.expressDelivery ?? false,
      // Charged per extra pickup location, same as the server does.
      extraPickups: extraPickupsForPricing(extraPickupLocations),
      pickupFloor: effectivePickupFloor,
      deliveryFloor: effectiveDeliveryFloor,
      pickupLiftAvailable: effectivePickupLiftAvailable,
      deliveryLiftAvailable,
      extraPickupFloors,
      locale,
      useFullDistanceKmPricing: adminUseFullKm,
      ...(adminHandling
        ? {
            adjustments: { rabatt: adminHandling.rabatt, leggTil: adminHandling.leggTil },
            deviation: adminHandling.deviation
              ? {
                  label: adminHandling.deviation,
                  customPrice: adminHandling.customDeviation.price,
                  customSubcontractorPrice: adminHandling.customDeviation.subcontractorPrice,
                  customDescription: adminHandling.customDeviation.description,
                }
              : null,
          }
        : {}),
    }).result;
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
    extraPickupFloors,
    extraPickupLocations,
    adminHandling,
    adminUseFullKm,
  ]);

  // Website prices are ex. VAT: the customer's total incl. VAT is each line
  // with 25% added, rounded to whole kroner, summed (websiteVat.ts) — the
  // same rule the server checks shownTotal against.
  const customerTotals = useMemo(() => websiteCustomerTotals(pricing), [pricing]);
  const finalVatDisplay = websiteCustomerTotalDisplay({
    totalExVat: customerTotals.totalExVat,
    totalIncVat: customerTotals.totalIncVat,
    customerType: customerType ?? undefined,
  });
  const finalVatBreakdown = { exVat: customerTotals.totalExVat, vat: customerTotals.vat, incVat: customerTotals.totalIncVat };

  // Charges not tied to a specific product card (floor surcharge,
  // long-distance delivery, …) — see buildWhiteGoodsCalculatorBreakdowns.
  const orderExtraLines: OrderSummaryExtraLine[] = useMemo(() => {
    const extrasBreakdown = pricing.breakdowns.find((b) => b.isOrderExtras);
    return [
      ...(extrasBreakdown?.lines ?? []).map((line) => ({
        label: localizeWebsiteLineLabel(line.label, locale),
        price: line.lineTotal,
        qty: line.qty,
      })),
      // A staff discount / extra (rabatt, leggTil) — otherwise the lines
      // wouldn't add up to the total in "My order" and the admin editor.
      ...buildOrderAdjustmentLines(pricing.totals, locale),
    ];
  }, [pricing, locale]);

  // Converted here (rather than in FloorLiftField) since this is the one
  // place in the tree that already holds customerType — the badge itself
  // just renders whatever amount it's given.
  const floorSurchargePerFloor = websiteCustomerPrice(
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
            label: localizeWebsiteLineLabel(line.label, locale),
            price: line.lineTotal,
            qty: line.qty,
            category: categorizeWhiteGoodsLineCode(line.code),
            blankWhenFree: line.code === "INSTALL_ONLY",
          })),
        );
        const siblings = productCards.filter((c) => c.productId === card.productId);
        const title = getSummaryProductTitle({
          product,
          itemName: card.modelNumber,
          label: productLabel(locale, product),
        });
        return {
          cardId: card.cardId,
          // Other furniture is titled with the customer's own name, the product
          // label under it. A product split into several cards is numbered so
          // they can be told apart.
          name: siblings.length > 1 ? `${title.name} #${siblings.indexOf(card) + 1}` : title.name,
          subtitle: title.subtitle,
          code: product.code,
          iconKey: product.iconKey ?? null,
          qty: card.amount,
          total: lines.reduce((sum, line) => sum + line.price, 0),
          lines,
        };
      })
      .filter((p): p is OrderSummaryProduct => p !== null);
  }, [productCards, catalogProducts, pricing, locale]);

  // Size-priced products (Other furniture) also need a volume and a weight
  // bracket chosen — the server rejects an order without them.
  const sizeBracketsComplete =
    findCardsWithSizeBracketProblems(productCards, catalogProducts).length === 0 &&
    findSizePricedCardsMissingName(productCards, catalogProducts).length === 0 &&
    findOtherManufacturerCardsMissingName(productCards, catalogProducts).length === 0;
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
  const orgNumberReady = customerType !== "business" || isValidOrgNumber(orgNumber);
  const canContinueContact = !!name.trim() && orgNumberReady && !!phone.trim() && emailValid && allPickupLocationsReady;
  const canSubmit =
    name.trim() &&
    phone.trim() &&
    emailValid &&
    sizeBracketsComplete &&
    allPickupLocationsReady &&
    canContinueOrderDetails &&
    !submitLoading;

  // Uploads every store stop's document not sent yet. Returns the token to
  // send with the order (null when there are no documents), or false with
  // submitError set when an upload failed — the order is then not sent, so
  // it never goes through missing a document the customer picked.
  async function uploadPickupDocuments(): Promise<string | null | false> {
    const wanted = collectPickupDocuments([
      { source: pickupSource, document: pickupDocument },
      ...extraPickupLocations.map((loc) => ({ source: loc.source, document: loc.document ?? null })),
    ]);
    const plan = planPickupDocumentUploads(wanted, sentPickupDocumentsRef.current);
    if (plan.freshToken || !pickupDocumentTokenRef.current) {
      pickupDocumentTokenRef.current = crypto.randomUUID();
      sentPickupDocumentsRef.current = [];
    }
    if (wanted.length === 0) return null;

    for (const doc of plan.toUpload) {
      const form = new FormData();
      form.append("file", doc.file);
      form.append("uploadToken", pickupDocumentTokenRef.current);
      form.append("stopIndex", String(doc.stopIndex));
      let reason: string | null = "NETWORK";
      try {
        const res = await fetch("/api/site/white-goods-order/pickup-document", { method: "POST", body: form });
        const json = await res.json().catch(() => ({}));
        reason = res.ok && json.ok ? null : String(json.reason ?? res.status);
      } catch {
        // reason stays NETWORK
      }
      if (reason) {
        setSubmitError(pickupDocumentUploadError(doc.file.name, reason));
        return false;
      }
      sentPickupDocumentsRef.current.push(doc);
    }
    return pickupDocumentTokenRef.current;
  }

  function pickupDocumentUploadError(filename: string, reason: string): string {
    switch (reason) {
      case "FILE_TOO_LARGE":
        return t(
          `"${filename}" is too large. The maximum size is ${MAX_PICKUP_DOCUMENT_SIZE_MB} MB.`,
          `"${filename}" er for stor. Maks størrelse er ${MAX_PICKUP_DOCUMENT_SIZE_MB} MB.`,
        );
      case "INVALID_FILE_TYPE":
        return t(
          `"${filename}" is not a valid PDF, JPG or PNG file. Please choose another file.`,
          `"${filename}" er ikke en gyldig PDF-, JPG- eller PNG-fil. Velg en annen fil.`,
        );
      case "RATE_LIMITED":
      case "TOO_MANY_FILES":
        return t(
          "Too many files have been uploaded. Please try again later, or send the order without the document.",
          "For mange filer er lastet opp. Prøv igjen senere, eller send bestillingen uten dokumentet.",
        );
      default:
        return t(
          `Could not upload "${filename}". Please check your connection and try again.`,
          `Kunne ikke laste opp "${filename}". Sjekk tilkoblingen og prøv igjen.`,
        );
    }
  }

  async function handleSubmit() {
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const pickupDocumentToken = await uploadPickupDocuments();
      if (pickupDocumentToken === false) return;
      const res = await fetch("/api/site/white-goods-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCards,
          pickupSource,
          pickupPlaceName,
          pickupContactName,
          pickupContactPhone,
          ...(pickupDocumentToken ? { pickupDocumentToken } : {}),
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
          // Stored on the order for the admin view (websiteBookingDetails).
          customerType,
          ...(customerType === "business" ? { orgNumber } : {}),
          // The total shown above — the server only accepts the order at
          // this price (see app/api/site/white-goods-order).
          // What the customer saw and pays: incl. VAT, summed per line.
          shownTotal: customerTotals.totalIncVat,
          // Only present once the order was actually split across more than
          // one pickup address — omitted for the common single-location
          // case so that payload stays exactly as it always has been.
          ...(!allProductsPickedUpHere && poolCardIds.length > 1
            ? { pickupProductNames: location0Claimed.map(pickupChecklistName) }
            : {}),
          // Which product cards each stop collects (the admin editor puts
          // them back on their stops from these).
          pickupCardIds: location0Claimed,
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
                  cardIds: claimedCardIds(extraPickupPools[i] ?? [], loc.allRemainingHere, loc.selectedCardIds),
                })),
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!json.ok && json.reason === "PRICE_CHANGED") {
        const total = Number(json.total);
        setSubmitError(
          t(
            `The price has changed to ${total.toLocaleString("nb-NO")} kr since you started. Please reload the page to see the updated price before ordering.`,
            `Prisen er endret til ${total.toLocaleString("nb-NO")} kr siden du startet. Last inn siden på nytt for å se oppdatert pris før du bestiller.`,
          ),
        );
        return;
      }
      if (!json.ok && json.errors?.pickupDocument) {
        setSubmitError(
          t(
            "The receipt or order confirmation for a store pickup is missing. Please upload it and try again.",
            "Kvittering eller ordrebekreftelse for en butikkhenting mangler. Last den opp og prøv igjen.",
          ),
        );
        return;
      }
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
  // steps, in the order they were added; "any other products?" sits at the
  // bottom of the last list's options step until every list is on the order.
  // Steps reveal one after another, so a newly added list's steps slot in
  // ahead of the address/contact steps (and take over the question).
  const moreProductsCode = moreProductsHostCode({
    chosenCodes: chosenListCodes,
    remainingCount: remainingLists.length,
    customerLocked,
  });
  const listSections: StepSection[] = chosenListCodes.flatMap((code, index) => {
    const info = availableLists.find((l) => l.code === code);
    const listProducts = loadedProducts[code] ?? [];
    const suffix = index > 0 && info ? ` — ${t(info.labelEn, info.labelNo)}` : "";

    const productsStep: StepSection = {
      id: `products-${code}`,
      title: t("Choose products", "Velg produkter") + suffix,
      // An added category's products scroll into view — each time, also when
      // it was removed ("not needed") and a category is picked again.
      scrollOnReveal: index > 0,
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
              className="customContainer self-center inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-logoblue transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {t("Not needed — remove this category", "Trengs ikke — fjern denne kategorien")}
            </button>
          )}

          <AutoAdvance
            ready={isProductsStepReady({
              ownCount: cardsForList(productCards, listProducts).length,
              orderCount: productCards.length,
              wasPopulated: populatedListCodes.includes(code),
            })}
            onReady={onComplete}
            onRetract={onUncomplete}
          />
        </div>
      ),
    };

    // Within 24h of the job only the cards with a service left to add — one
    // whose services are all booked has nothing to click.
    const optionCards = cardsForList(productCards, listProducts).filter((card) => {
      if (!customerLocked) return true;
      const product = listProducts.find((p) => p.id === card.productId);
      const booked = bookedCards.get(card.cardId);
      return !!product && !!booked && hasAddableServices(product, booked);
    });
    const optionsReady = isListOptionsStepReady({
      cards: productCards,
      listProducts,
      wasPopulated: populatedListCodes.includes(code),
    });
    const hostsMoreProducts = code === moreProductsCode;
    const optionsStep: StepSection = {
      id: `product-options-${code}`,
      title: t("Product options", "Produktvalg") + suffix,
      // Nothing to configure once every product of the list is unticked
      // (unless it still holds "any other products?").
      hidden: optionCards.length === 0 && !hostsMoreProducts,
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col gap-10">
        <div className={customerLocked ? "flex flex-col gap-4" : "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]"}>
          <div className="flex flex-col gap-4">
            <AnimatedStack
              gap={16}
              items={optionCards.flatMap((card) => {
                const product = listProducts.find((p) => p.id === card.productId);
                if (!product) return [];
                // Cards of one product sit next to each other (see
                // addAnotherProductCard). Size-priced products (Other furniture)
                // have one card per product (their size is the item's own), so
                // they can't be split; their name, size and weight are the
                // card's last section.
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
                        booked={customerLocked ? bookedCards.get(card.cardId) : undefined}
                        onRemove={isSplit && !customerLocked ? () => removeCard(card.cardId) : undefined}
                        onAddAnother={
                          isLastOfProduct && !isSizePricedProduct(product) && !customerLocked
                            ? () => addAnotherCard(product.id)
                            : undefined
                        }
                        // Within 24h of the job the size stays as booked (a
                        // change there is staff-mediated).
                        belowOptions={
                          isSizePricedProduct(product) && !customerLocked
                            ? (nextStep) => (
                                <SizeBracketPicker
                                  embedded
                                  firstStep={nextStep}
                                  locale={locale}
                                  customerType={customerType ?? "private"}
                                  product={product}
                                  selectedIds={getSelectedSizeOptionIds(productCards, product)}
                                  dimensions={getSizeDimensions(productCards, product)}
                                  itemName={card.modelNumber}
                                  onSelect={selectSizeBracket}
                                  onSelectDimension={selectSizeDimension}
                                  onChangeItemName={changeItemName}
                                />
                              )
                            : undefined
                        }
                      />
                    ),
                  },
                ];
              })}
            />
            <AutoAdvance
              ready={isListOptionsStepComplete({
                optionsReady,
                // "My order" shows every step at once — nothing to hold back.
                hostsMoreProducts: hostsMoreProducts && !customer,
                declinedMoreProducts,
              })}
              onReady={onComplete}
              onRetract={onUncomplete}
            />
          </div>

          {/* Every options step keeps its own calculator. It is sticky within
              its step, so scrolling past one step hands over to the next
              step's calculator instead of the column disappearing. Within 24h
              of the job ("My order") there is no calculator — the footer
              shows what the added services cost. */}
          {!customerLocked && (
          <div className="lg:sticky lg:top-0 lg:self-start">
            <WhiteGoodsOrderSummary
              locale={locale}
              products={summaryProducts}
              orderExtras={orderExtraLines}
              totalExVat={customerTotals.totalExVat}
              totalIncVat={customerTotals.totalIncVat}
              customerType={customerType ?? "private"}
            />
          </div>
          )}
        </div>

        {/* "Any other products?" — part of this step, not one of its own.
            Appears once the options are filled in; the steps after this one
            wait for "no, continue" (or a picked category, which moves the
            question to that category's options step). */}
        {hostsMoreProducts && optionsReady && (
          <div className="flex flex-col items-center gap-3">
            <h5 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
              {t("Any other products you need added?", "Trenger du å legge til andre produkter?")}
            </h5>
            <WebsiteListTiles
              locale={locale}
              lists={remainingLists}
              selectedCode={null}
              loadingCode={loadingListCode}
              onPick={(next) => addList(next)}
            />
            {addListError && <p className="text-xs text-red-600">{addListError}</p>}
            {!customer && (
              <button
                type="button"
                onClick={() => setDeclinedMoreProducts(true)}
                aria-pressed={declinedMoreProducts}
                className={`mt-2 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-lg ${
                  declinedMoreProducts ? "bg-logoblue text-white" : "customContainer bg-white text-logoblue"
                }`}
              >
                {t("No, continue to order details", "Nei, fortsett med ordredetaljer")}
              </button>
            )}
          </div>
        )}
        </div>
      ),
    };

    return [productsStep, optionsStep];
  });

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
    // The customer changing their order adds categories through "any other products?" instead —
    // picking a different start category here would empty the order.
    ...(customer ? [] : ([{
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
    }] satisfies StepSection[])),
    ...listSections,
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
      bottomSpace: true,
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
              floorSurchargePerFloor={floorSurchargePerFloor}
              // New orders only — the admin/customer editors don't upload.
              pickupDocument={pickupDocument}
              setPickupDocument={customer ? undefined : setPickupDocument}
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
                    floorSurchargePerFloor={floorSurchargePerFloor}
                    allowDocument={!customer}
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
              // Clearing one of the first pickup's own fields isn't a split,
              // so it still retracts them.
              hold={keepsLaterStepsOnPickupRetract({
                firstPickupReady,
                laterDetailsEntered: hasEnteredOrderOrContactDetails({
                  deliveryAddress,
                  preferredDate,
                  timeWindow,
                  name,
                  phone,
                  email,
                  notes,
                }),
              })}
              onRetract={onUncomplete}
            />
          </div>
        ) : null,
    },
    {
      id: "order-details",
      title: t("Order details", "Ordredetaljer"),
      bottomSpace: true,
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
      // The one step with an explicit button instead of AutoAdvance: moving on
      // swaps the whole modal to the review page, so it mustn't fire the
      // moment the email first parses as valid while still being typed, or
      // before the optional notes.
      render: ({ onComplete }) => (
        <div className="flex flex-col gap-4">
          <ContactDetailsCard
            locale={locale}
            customerType={customerType}
            name={name}
            setName={setName}
            orgNumber={orgNumber}
            setOrgNumber={setOrgNumber}
            orgNumberLocked={!!customer}
            phone={phone}
            setPhone={setPhone}
            email={email}
            setEmail={setEmail}
            notes={notes}
            setNotes={setNotes}
          />

          {!customer && (
          <button
            type="button"
            disabled={!canContinueContact}
            onClick={onComplete}
            className="self-center inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {t("Go to summary", "Gå til oppsummering")}
          </button>
          )}
        </div>
      ),
    },
  ];

  // Product names per pickup follow the same rule as the submitted payload:
  // the first location only lists its products once the order is split.
  const reviewInput: ReviewInput = {
    pickups: [
      {
        source: pickupSource,
        placeName: pickupPlaceName,
        address: pickupAddress,
        floor: pickupFloor,
        liftAvailable: pickupLiftAvailable,
        contactName: pickupSource === "store" ? "" : pickupContactName,
        contactPhone: pickupSource === "store" ? "" : pickupContactPhone,
        productNames:
          !allProductsPickedUpHere && poolCardIds.length > 1 ? location0Claimed.map(pickupChecklistName) : undefined,
      },
      ...extraPickupLocations.map((loc, i) => ({
        source: loc.source,
        placeName: loc.placeName,
        address: loc.address,
        floor: loc.floor,
        liftAvailable: loc.liftAvailable,
        contactName: loc.source === "store" ? "" : loc.contactName,
        contactPhone: loc.source === "store" ? "" : loc.contactPhone,
        productNames: claimedCardIds(extraPickupPools[i] ?? [], loc.allRemainingHere, loc.selectedCardIds).map(
          pickupChecklistName,
        ),
      })),
    ],
    delivery: { address: deliveryAddress, floor: deliveryFloor, liftAvailable: deliveryLiftAvailable },
    preferredDate,
    timeWindow,
    drivingDistance,
    contact: { name, phone, email, notes, customerType, orgNumber },
  };
  const reviewBlocks = buildOrderReviewBlocks(locale, reviewInput);

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
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-sm font-semibold text-logoblue transition hover:opacity-70"
          >
            <span aria-hidden="true">←</span>
            {t("Back", "Tilbake")}
          </button>

          <h4 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
            {t("Summary", "Oppsummering")}
          </h4>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
            {/* All the answers in one card, sections split by a line (as in the admin modal). */}
            <div className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white lg:self-start">
              <OrderReviewBlocks blocks={reviewBlocks} bare />
            </div>

            <div className="flex flex-col gap-4 lg:self-start">
              <WhiteGoodsOrderSummary
                locale={locale}
                products={summaryProducts}
                orderExtras={orderExtraLines}
                totalExVat={customerTotals.totalExVat}
                totalIncVat={customerTotals.totalIncVat}
                customerType={customerType ?? "private"}
                totalFooter={
                  <ReviewTotalFooter
                    locale={locale}
                    {...finalVatBreakdown}
                    emphasiseExVat={finalVatDisplay.primary === "exVat"}
                  />
                }
              />

              {/* "My order" saves from its edit bar (CustomerOrderEditFooter). */}
              {!customer && submitError && <p className="text-sm text-red-600">{submitError}</p>}

              {!customer && (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
              >
                {submitLoading ? t("Sending…", "Sender…") : t("Submit order", "Send bestilling")}
              </button>
              )}
            </div>
          </div>
        </div>
      ),
  };

  // The edited order in the editors' shape (admin and customer saves).
  const editedDetails = adminDetailsFromFlow({
    customerType,
    name,
    orgNumber,
    phone,
    email,
    notes,
    firstPickup: {
      source: pickupSource,
      placeName: pickupPlaceName,
      address: pickupAddress,
      floor: pickupSource === "store" ? null : pickupFloor,
      liftAvailable: pickupSource === "store" ? false : pickupLiftAvailable,
      contactName: pickupSource === "store" ? "" : pickupContactName,
      contactPhone: pickupSource === "store" ? "" : pickupContactPhone,
      cardIds: location0Claimed,
      productNames: location0Claimed.map(pickupChecklistName),
    },
    extraPickups: extraPickupLocations.map((loc, i) => {
      const claimed = claimedCardIds(extraPickupPools[i] ?? [], loc.allRemainingHere, loc.selectedCardIds);
      return {
        source: loc.source,
        placeName: loc.placeName,
        address: loc.address,
        floor: loc.source === "store" ? null : loc.floor,
        liftAvailable: loc.source === "store" ? false : loc.liftAvailable,
        contactName: loc.source === "store" ? "" : loc.contactName,
        contactPhone: loc.source === "store" ? "" : loc.contactPhone,
        cardIds: claimed,
        productNames: claimed.map(pickupChecklistName),
      };
    }),
    delivery: { address: deliveryAddress, floor: deliveryFloor, liftAvailable: deliveryLiftAvailable },
    preferredDate,
    timeWindow,
    drivingDistance,
  });
  // The server's rule, on the stops about to be sent: once the order is split
  // across pickups, every product needs a stop with an address.
  // ...and every pickup address collects something (only while pickups can
  // still be changed — after the cutoff the customer couldn't fix it anyway).
  const productsWithoutPickup = findCardsWithoutPickup(editedDetails.pickups, productCards).length > 0;
  const emptyPickups = customerLocked ? [] : findPickupsWithoutProducts(editedDetails.pickups);
  const pickupBlockedMessage = productsWithoutPickup
    ? customerLocked
      ? t(
          "A new product needs a pickup address, and pickups can't be changed this close to the job. Contact us.",
          "Et nytt produkt trenger en henteadresse, og henting kan ikke endres så nær oppdraget. Ta kontakt med oss.",
        )
      : t(
          "Choose which pickup address every product is collected from.",
          "Velg hvilken henteadresse hvert produkt hentes fra.",
        )
    : emptyPickups.length > 0
      ? t(
          `Pickup address ${emptyPickups.map((i) => i + 1).join(", ")} has no products. Choose what is collected there, or remove it.`,
          `Henteadresse ${emptyPickups.map((i) => i + 1).join(", ")} har ingen produkter. Velg hva som hentes der, eller fjern den.`,
        )
      : null;

  const customerDraft: CustomerEditDraft = {
    customer: { name, phone, email, comments: notes },
    preferredDate,
    timeWindow,
    pickups:
      customerLocked && customerLoadedPickups.current
        ? withPickupContacts(customerLoadedPickups.current, editedDetails.pickups)
        : editedDetails.pickups,
    delivery: editedDetails.delivery,
    productCards,
  };
  const customerDraftKey = JSON.stringify(customerDraft);

  // The order as loaded, once the flow has settled (its own effects tidy the
  // loaded state on the first renders) — what "only send what changed"
  // compares with.
  useEffect(() => {
    if (!customer || !adminReady || customerInitialDraft) return;
    const timer = setTimeout(() => setCustomerInitialDraft(JSON.parse(customerDraftKey)), 300);
    return () => clearTimeout(timer);
  }, [customer, adminReady, customerInitialDraft, customerDraftKey]);

  // The pickups with a contact person (private / business, not a store).
  const numberedPickups = extraPickupLocations.length > 0;
  const pickupContactPersons: (PickupContactPerson & { source: PickupSource | null })[] = [
    {
      key: "first",
      source: pickupSource,
      title: numberedPickups ? `${t("Pickup", "Henting")} 1` : t("Pickup", "Henting"),
      address: pickupAddress,
      name: pickupContactName,
      phone: pickupContactPhone,
      onName: setPickupContactName,
      onPhone: setPickupContactPhone,
    },
    ...extraPickupLocations.map((loc, i) => ({
      key: String(loc.id),
      source: loc.source,
      title: `${t("Pickup", "Henting")} ${i + 2}`,
      address: loc.address,
      name: loc.contactName,
      phone: loc.contactPhone,
      onName: (contactName: string) => updateExtraPickupLocation(loc.id, { contactName }),
      onPhone: (contactPhone: string) => updateExtraPickupLocation(loc.id, { contactPhone }),
    })),
  ].filter((stop) => stop.source !== "store");

  const loadingSections: StepSection[] = [
    {
      id: "admin-loading",
      title: adminLoadError ? t("Couldn't load the order", "Kunne ikke laste bestillingen") : t("Loading order…", "Laster bestilling…"),
      render: () => null,
    },
  ];

  if (customer) {
    // Within 24h of the job its own set of sections, all untitled: contact
    // details and comment, pickup contact persons, and services to add.
    // Otherwise everything but the customer type, which was answered at
    // booking.
    const lateSections: StepSection[] = [
      ...sections.filter((section) => section.id === "contact"),
      {
        id: "pickup-contacts",
        title: t("Contact person at pickup", "Kontaktperson ved henting"),
        hidden: pickupContactPersons.length === 0,
        render: () => <PickupContactPersonsCard locale={locale} stops={pickupContactPersons} />,
      },
      ...sections.filter((section) => section.id.startsWith("product-options-")),
    ].map((section) => ({ ...section, title: "", description: undefined }));
    const customerSections = customerLocked ? lateSections : sections.filter((section) => section.id !== "customer-type");
    return (
      <SteppedModal
        showAll
        // The late sections are untitled, so they sit closer together.
        sectionGap={customerLocked ? 16 : undefined}
        sections={adminReady ? customerSections : loadingSections}
        finalStep={finalStep}
        finalStepOpen={!customerLocked && customerSummaryOpen}
        onFinalStepBack={() => setCustomerSummaryOpen(false)}
        onClose={onClose}
        title={
          <span className="truncate text-base font-semibold text-logoblue">
            {t("Change order", "Endre bestilling")} #{customer.orderNumber}
          </span>
        }
        footer={
          adminReady && customerInitialDraft ? (
            <CustomerOrderEditFooter
              orderNumber={customer.orderNumber}
              initial={customerInitialDraft}
              current={customerDraft}
              beforeCutoff={customer.beforeCutoff}
              locale={locale}
              onCancel={onClose}
              onSaved={customer.onSaved}
              blockedMessage={pickupBlockedMessage}
              summaryOpen={customerSummaryOpen}
              onOpenSummary={() => setCustomerSummaryOpen(true)}
            />
          ) : null
        }
      />
    );
  }

  return <SteppedModal sections={sections} finalStep={finalStep} onClose={onClose} dimCompleted />;
}
