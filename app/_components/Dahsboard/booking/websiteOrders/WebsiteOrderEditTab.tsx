"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { SectionHeader, WhiteGoodsProductCard } from "@/app/_components/site/BookingModal/whiteGoods/WhiteGoodsProductCard";
import { SizeBracketPicker } from "@/app/_components/site/BookingModal/whiteGoods/SizeBracketPicker";
import { productLabel } from "@/app/_components/site/BookingModal/whiteGoods/WhiteGoodsProductGrid";
import { getCalculatorProductName } from "@/app/_components/site/BookingModal/whiteGoods/productDisplayName";
import { previewCardDeliveryOptions } from "@/app/_components/site/BookingModal/whiteGoods/deliveryPricePreview";
import {
  applyItemName,
  applySizeBracketSelection,
  applySizeDimension,
  getSelectedSizeOptionIds,
  getSizeDimensions,
} from "@/app/_components/site/BookingModal/whiteGoods/sizeBracketSelection";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { isSizePricedProduct } from "@/lib/booking/pricing/sizeBrackets";
import { PRESET_TIME_WINDOWS } from "@/lib/booking/timeWindows";
import { findCardsWithoutPickup } from "@/lib/orders/pickupAssignment";
import type { AdminOrderDetails } from "@/lib/orders/websiteOrderDetailsEdit";
import type { BookingCustomerType, BookingPickupSource } from "@/lib/orders/websiteBookingDetails";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import type { WebsiteOrderCalculatorView, WebsiteOrderPricingDraft } from "@/lib/orders/websiteOrderCalculator";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";
import WebsiteOrderCalculator from "./WebsiteOrderCalculator";
import {
  addProductToOrder,
  addStop,
  editorBlockers,
  removeCardFromOrder,
  removeStop,
  stopsForSave,
  stopsFromDetails,
  toggleCardOnStop,
  type EditorBlocker,
  type EditorStop,
} from "./websiteOrderEditorState";

type Props = {
  orderId: string;
  locale: BookingUiLocale;
  // After a successful save — the modal reloads the order and goes back to Overview.
  onSaved: (message: string) => void;
  onCancel: () => void;
  // Tells the modal whether there are unsaved edits (to confirm before leaving).
  onDirtyChange: (dirty: boolean) => void;
};

type Category = { code: string; labelEn: string; labelNo: string; productIds: string[] };
type Details = Omit<AdminOrderDetails, "pickups" | "drivingDistanceOverride">;
type CalculatorAdjustments = WebsiteOrderPricingDraft["adjustments"];

const NO_ADJUSTMENTS: CalculatorAdjustments = { rabatt: "", leggTil: "", subcontractorMinus: "", subcontractorPlus: "" };

const PREVIEW_DELAY_MS = 800;
const SOURCES: BookingPickupSource[] = ["store", "private", "business"];

// The admin's own editor for a homepage order, inside WebsiteOrderModal's
// "Edit order" tab: dashboard-style fields, the website's product cards (same
// rules as the customer's booking flow) and pickup addresses that each list the
// products collected there. Priced and saved through
// /api/orders/[orderId]/website-items, like before.
export default function WebsiteOrderEditTab({ orderId, locale, onSaved, onCancel, onDirtyChange }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const cardLocale = locale === "nb" ? "no" : "en";

  const [loadError, setLoadError] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<SavedProductCard[]>([]);
  const [stops, setStops] = useState<EditorStop[]>([]);
  const [details, setDetails] = useState<Details | null>(null);
  const [initialKey, setInitialKey] = useState<string | null>(null);
  // The order's own products open collapsed; ones added here open expanded.
  const [collapsedCardIds, setCollapsedCardIds] = useState<Set<number>>(() => new Set());

  const [preview, setPreview] = useState<{ comparison: OrderPaymentComparison; calculator: WebsiteOrderCalculatorView } | null>(null);
  // The order as first priced: the calculator's baseline for its own choices.
  const [firstCalculator, setFirstCalculator] = useState<WebsiteOrderCalculatorView | null>(null);
  // Discount / extra / partner minus-plus as stored, and the calculator's unsaved changes to them.
  const [adjustments, setAdjustments] = useState<CalculatorAdjustments>(NO_ADJUSTMENTS);
  const [pricingDraft, setPricingDraft] = useState<WebsiteOrderPricingDraft | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const previewSeq = useRef(0);

  function productOf(card: SavedProductCard) {
    return card.productId ? catalogProducts.find((p) => p.id === card.productId) : undefined;
  }

  // "Vaskemaskin #2 (×2)" — the same naming the customer's pickup checklists use.
  function cardName(cardId: number): string {
    const card = cards.find((c) => c.cardId === cardId);
    const product = card ? productOf(card) : undefined;
    if (!card || !product) return String(cardId);
    const base = getCalculatorProductName({ product, itemName: card.modelNumber, label: productLabel(cardLocale, product) });
    const siblings = cards.filter((c) => c.productId === card.productId);
    const name = siblings.length > 1 ? `${base} #${siblings.indexOf(card) + 1}` : base;
    return card.amount > 1 ? `${name} (×${card.amount})` : name;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/website-items`, { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!json?.ok || !json.details) throw new Error(json?.reason ?? "load failed");
        const loadedCards: SavedProductCard[] = json.productCards;
        const products: CatalogProduct[] = json.catalogProducts;
        const loaded: AdminOrderDetails = json.details;
        const nameOf = (cardId: number) => {
          const card = loadedCards.find((c) => c.cardId === cardId);
          const product = card?.productId ? products.find((p) => p.id === card.productId) : undefined;
          return card && product
            ? getCalculatorProductName({ product, itemName: card.modelNumber, label: productLabel("no", product) })
            : "";
        };
        const loadedStops = stopsFromDetails(loaded.pickups, loadedCards, nameOf);
        const rest: Details = {
          customer: loaded.customer,
          delivery: loaded.delivery,
          preferredDate: loaded.preferredDate,
          timeWindow: loaded.timeWindow,
        };
        setCatalogProducts(products);
        setCategories(json.categories ?? []);
        setCards(loadedCards);
        setCollapsedCardIds(new Set(loadedCards.map((card) => card.cardId)));
        setStops(loadedStops);
        setDetails(rest);
        setInitialKey(JSON.stringify({ cards: loadedCards, stops: loadedStops, details: rest }));
        const handling = json.handling ?? {};
        setAdjustments({
          rabatt: handling.rabatt ?? "",
          leggTil: handling.leggTil ?? "",
          subcontractorMinus: handling.subcontractorMinus ?? "",
          subcontractorPlus: handling.subcontractorPlus ?? "",
        });
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const currentKey = details ? JSON.stringify({ cards, stops, details }) : null;
  const dirty = (!!initialKey && currentKey !== initialKey) || !!pricingDraft;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const payload = useMemo(() => {
    if (!details) return null;
    const saveDetails: AdminOrderDetails = { ...details, pickups: stopsForSave(stops, cardName), drivingDistanceOverride: null };
    return {
      productCards: cards,
      details: saveDetails,
      // The calculator's own choices ride along, so they're priced and saved with the edits.
      ...(pricingDraft ? { handling: pricingDraft.adjustments, nulledLines: pricingDraft.nulledLines } : {}),
    };
    // cardName reads cards/catalogProducts, both already dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, stops, details, catalogProducts, pricingDraft]);

  const blockers = details ? editorBlockers(cards, stops, catalogProducts) : [];

  const reasonText: Record<string, string> = {
    PRODUCT_WITHOUT_PICKUP: t("Every product needs a pickup address.", "Hvert produkt må ha en henteadresse."),
    SIZE_BRACKETS_REQUIRED: t("Choose the size and weight of every item.", "Velg størrelse og vekt for alle varer."),
    ITEM_NAME_REQUIRED: t("Say what each item is.", "Skriv hva hver vare er."),
    INSTALL_OPTION_REQUIRED: t("Installation only needs an installation chosen.", "Kun montering krever at en montering er valgt."),
    UNKNOWN_PRODUCT: t("One of the products isn't sold on the website.", "En av varene selges ikke på nettsiden."),
    NOT_EDITABLE_STATUS: t("This order is closed and can't be changed.", "Denne bestillingen er avsluttet og kan ikke endres."),
    INVALID_DETAILS: t("Check the name, phone and email.", "Sjekk navn, telefon og e-post."),
    FORBIDDEN: t("Only admins can change website orders.", "Kun administratorer kan endre nettsidebestillinger."),
  };
  // The pickup blocker names the products, so the admin knows which ones to tick.
  const blockerText = (blocker: EditorBlocker) => {
    if (blocker !== "PRODUCT_WITHOUT_PICKUP") return reasonText[blocker];
    const names = findCardsWithoutPickup(stops, cards).map(cardName).join(", ");
    return t(`Needs a pickup address: ${names}.`, `Mangler henteadresse: ${names}.`);
  };
  // The server's dry run reports the same rules — don't repeat a blocker already listed.
  const showError = !!error && !blockers.some((blocker) => reasonText[blocker] === error);

  async function send(dryRun: boolean) {
    const res = await fetch(`/api/orders/${orderId}/website-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...payload, dryRun }),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && !!json?.ok, json };
  }

  // Every change priced on the server (debounced) — the same pricing the save uses.
  const payloadKey = payload ? JSON.stringify(payload) : "";
  useEffect(() => {
    if (!payloadKey) return;
    const seq = ++previewSeq.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const { ok, json } = await send(true);
        if (seq !== previewSeq.current) return;
        setPreview(ok ? { comparison: json.comparison, calculator: json.calculator } : null);
        if (ok) setFirstCalculator((current) => current ?? json.calculator);
        setError(ok ? "" : (json?.reason && reasonText[json.reason]) || t("Couldn't price the order.", "Kunne ikke prise bestillingen."));
      } catch {
        if (seq === previewSeq.current) setPreview(null);
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  async function handleSave() {
    if (blockers.length > 0 || saving) return;
    setError("");
    setSaving(true);
    try {
      const { ok, json } = await send(false);
      if (!ok) {
        setError((json?.reason && reasonText[json.reason]) || t("Couldn't save the order.", "Kunne ikke lagre bestillingen."));
        return;
      }
      onSaved(t("Order saved.", "Bestillingen er lagret."));
    } catch {
      setError(t("Couldn't save the order.", "Kunne ikke lagre bestillingen."));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return <p className="py-6 text-sm text-red-600">{t("Couldn't load the order.", "Kunne ikke laste bestillingen.")}</p>;
  }
  if (!details) {
    return <p className="py-6 text-sm text-black/50">{t("Loading order…", "Laster bestilling…")}</p>;
  }

  const fieldClass = "customInput w-full";
  const labelClass = "mb-1 block text-xs font-medium text-textColorThird";
  const sectionClass = "customContainer flex flex-col gap-4";
  const updateDetails = (patch: Partial<Details>) => setDetails((current) => (current ? { ...current, ...patch } : current));
  const updateStop = (index: number, patch: Partial<EditorStop>) =>
    setStops((current) => current.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));
  const productCards = cards.filter((card) => !!productOf(card));
  const sizePricedOnOrder = new Set(productCards.filter((card) => isSizePricedProduct(productOf(card)!)).map((c) => c.productId));
  const isSplit = stops.length > 1;

  function addProduct(productId: string) {
    if (!productId) return;
    const next = addProductToOrder(cards, stops, productId);
    setCards(next.cards);
    setStops(next.stops);
  }

  function removeCard(cardId: number) {
    // A card added later may reuse this id — it should open expanded.
    setCollapsedCardIds((current) => {
      const next = new Set(current);
      next.delete(cardId);
      return next;
    });
    const next = removeCardFromOrder(cards, stops, cardId);
    setCards(next.cards);
    setStops(next.stops);
  }

  function updateCard(next: SavedProductCard) {
    setCards((current) => current.map((card) => (card.cardId === next.cardId ? next : card)));
  }


  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-6">
        {/* Products — the website's cards, so the rules match the customer's */}
        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Products", "Produkter")}</h3>

          {productCards.length === 0 && <p className="text-sm text-black/50">{t("No products.", "Ingen produkter.")}</p>}
          {productCards.map((card) => {
            const product = productOf(card)!;
            const sizePriced = isSizePricedProduct(product);
            const siblings = productCards.filter((c) => c.productId === card.productId);
            return (
              <WhiteGoodsProductCard
                key={card.cardId}
                locale={cardLocale}
                customerType={details.customer.customerType ?? "private"}
                product={product}
                value={card}
                deliveryPreview={previewCardDeliveryOptions(cards, catalogProducts, card.cardId)}
                onChange={updateCard}
                onRemove={() => removeCard(card.cardId)}
                defaultOpen={!collapsedCardIds.has(card.cardId)}
                variantNumber={siblings.length > 1 ? siblings.indexOf(card) + 1 : undefined}
                // Last section of the card: a size-priced item's name / size /
                // weight (one card per item, so no quantity), else the quantity.
                belowOptions={
                  sizePriced
                    ? (nextStep) => (
                        <SizeBracketPicker
                          embedded
                          firstStep={nextStep}
                          locale={cardLocale}
                          customerType={details.customer.customerType ?? "private"}
                          product={product}
                          selectedIds={getSelectedSizeOptionIds(cards, product)}
                          dimensions={getSizeDimensions(cards, product)}
                          itemName={card.modelNumber}
                          onSelect={(p, optionId) => setCards((current) => applySizeBracketSelection(current, p, optionId))}
                          onSelectDimension={(p, axis, valueCm) => setCards((current) => applySizeDimension(current, p, axis, valueCm))}
                          onChangeItemName={(p, name) => setCards((current) => applyItemName(current, p, name))}
                        />
                      )
                    : (nextStep) => (
                        // Numbered like the card's own sections; the field itself is
                        // the booking app's (ProductCardNew), full width.
                        <div>
                          <SectionHeader
                            step={nextStep}
                            title={bookingText(locale, "Product amount")}
                            subtitle={t("How many of this product, with these choices?", "Hvor mange av dette produktet, med disse valgene?")}
                          />
                          <input
                            type="number"
                            min={1}
                            className="customInput w-full"
                            value={card.amount}
                            onChange={(e) => updateCard({ ...card, amount: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                          />
                        </div>
                      )
                }
              />
            );
          })}

          {/* Last, like the booking app's "Add extra products": opens the product list. */}
          {addingProduct ? (
            <select
              autoFocus
              className="customInput h-12 w-full"
              value=""
              onChange={(e) => {
                addProduct(e.target.value);
                setAddingProduct(false);
              }}
              onBlur={() => setAddingProduct(false)}
            >
              <option value="">{t("Choose a product…", "Velg et produkt…")}</option>
              {categories.map((category) => (
                <optgroup key={category.code} label={t(category.labelEn, category.labelNo)}>
                  {category.productIds
                    .map((id) => catalogProducts.find((p) => p.id === id))
                    .filter((p): p is CatalogProduct => !!p && p.active && !sizePricedOnOrder.has(p.id))
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {productLabel(cardLocale, product)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          ) : (
            <button type="button" className="customButtonEnabled h-12 w-full" onClick={() => setAddingProduct(true)}>
              {t("Add extra products", "Legg til flere produkter")}
            </button>
          )}
        </section>

        {/* Pickup addresses, each with the products collected there */}
        <section className={sectionClass}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-logoblue">{t("Pickup addresses", "Henteadresser")}</h3>
            <button type="button" className="customButtonDefault" onClick={() => setStops((current) => addStop(current))}>
              + {t("Add pickup address", "Legg til henteadresse")}
            </button>
          </div>
          {stops.map((stop, index) => (
            <div key={index} className="rounded-xl border border-black/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-semibold text-black/80">
                  {t("Pickup", "Henting")} {index + 1}
                </p>
                {isSplit && (
                  <button
                    type="button"
                    className="text-sm font-semibold text-red-600"
                    onClick={() => setStops((current) => removeStop(current, cards, index))}
                  >
                    {t("Remove", "Fjern")}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>{t("Type", "Type")}</span>
                  <select
                    className={fieldClass}
                    value={stop.source ?? ""}
                    onChange={(e) => {
                      const source = (e.target.value || null) as BookingPickupSource | null;
                      updateStop(index, source === "store" ? { source, floor: null, liftAvailable: false } : { source });
                    }}
                  >
                    <option value="">-</option>
                    {SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source === "store" ? t("Store", "Butikk") : source === "private" ? t("Private", "Privatperson") : t("Business", "Bedrift")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{t("Place name", "Stedsnavn")}</span>
                  <input className={fieldClass} value={stop.placeName} onChange={(e) => updateStop(index, { placeName: e.target.value })} />
                </label>
                <div className="sm:col-span-2">
                  <span className={labelClass}>{t("Address", "Adresse")}</span>
                  <AddressAutocompleteInput value={stop.address} onChange={(address) => updateStop(index, { address })} locale={locale} />
                </div>
                {stop.source !== "store" && (
                  <>
                    <label>
                      <span className={labelClass}>{t("Floor", "Etasje")}</span>
                      <input
                        type="number"
                        className={fieldClass}
                        value={stop.floor ?? ""}
                        onChange={(e) => updateStop(index, { floor: e.target.value === "" || e.target.value === "0" ? null : Number(e.target.value) })}
                      />
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-sm">
                      <input type="checkbox" checked={stop.liftAvailable} onChange={(e) => updateStop(index, { liftAvailable: e.target.checked })} />
                      {t("Lift available", "Heis tilgjengelig")}
                    </label>
                  </>
                )}
                <label>
                  <span className={labelClass}>{t("Contact name", "Kontaktperson")}</span>
                  <input className={fieldClass} value={stop.contactName} onChange={(e) => updateStop(index, { contactName: e.target.value })} />
                </label>
                <label>
                  <span className={labelClass}>{t("Contact phone", "Kontakttelefon")}</span>
                  <input className={fieldClass} value={stop.contactPhone} onChange={(e) => updateStop(index, { contactPhone: e.target.value })} />
                </label>
              </div>

              <div className="mt-4">
                <p className={labelClass}>{t("Products picked up here", "Produkter som hentes her")}</p>
                {!isSplit ? (
                  <p className="text-sm text-black/60">{t("All products are picked up here.", "Alle produkter hentes her.")}</p>
                ) : productCards.length === 0 ? (
                  <p className="text-sm text-black/50">{t("No products yet.", "Ingen produkter ennå.")}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {productCards.map((card) => {
                      const elsewhere = stops.findIndex((s, i) => i !== index && s.cardIds.includes(card.cardId));
                      return (
                        <label key={card.cardId} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={stop.cardIds.includes(card.cardId)}
                            onChange={(e) => setStops((current) => toggleCardOnStop(current, index, card.cardId, e.target.checked))}
                          />
                          <span>{cardName(card.cardId)}</span>
                          {elsewhere !== -1 && (
                            <span className="text-xs text-black/40">
                              ({t("now at pickup", "nå på henting")} {elsewhere + 1})
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Delivery */}
        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Delivery", "Levering")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className={labelClass}>{t("Address", "Adresse")}</span>
              <AddressAutocompleteInput
                value={details.delivery.address}
                onChange={(address) => updateDetails({ delivery: { ...details.delivery, address } })}
                locale={locale}
              />
            </div>
            <label>
              <span className={labelClass}>{t("Floor", "Etasje")}</span>
              <input
                type="number"
                className={fieldClass}
                value={details.delivery.floor ?? ""}
                onChange={(e) =>
                  updateDetails({
                    delivery: { ...details.delivery, floor: e.target.value === "" || e.target.value === "0" ? null : Number(e.target.value) },
                  })
                }
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={details.delivery.liftAvailable}
                onChange={(e) => updateDetails({ delivery: { ...details.delivery, liftAvailable: e.target.checked } })}
              />
              {t("Lift available", "Heis tilgjengelig")}
            </label>
            <label>
              <span className={labelClass}>{t("Date", "Dato")}</span>
              <input type="date" className={fieldClass} value={details.preferredDate} onChange={(e) => updateDetails({ preferredDate: e.target.value })} />
            </label>
            <label>
              <span className={labelClass}>{t("Time window", "Tidsvindu")}</span>
              <select className={fieldClass} value={details.timeWindow} onChange={(e) => updateDetails({ timeWindow: e.target.value })}>
                {!PRESET_TIME_WINDOWS.includes(details.timeWindow as (typeof PRESET_TIME_WINDOWS)[number]) && (
                  <option value={details.timeWindow}>{details.timeWindow || "-"}</option>
                )}
                {PRESET_TIME_WINDOWS.map((window) => (
                  <option key={window} value={window}>
                    {window}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Customer */}
        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Customer", "Kunde")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>{t("Name", "Navn")}</span>
              <input className={fieldClass} value={details.customer.name} onChange={(e) => updateDetails({ customer: { ...details.customer, name: e.target.value } })} />
            </label>
            <label>
              <span className={labelClass}>{t("Customer type", "Kundetype")}</span>
              <select
                className={fieldClass}
                value={details.customer.customerType ?? ""}
                onChange={(e) => updateDetails({ customer: { ...details.customer, customerType: (e.target.value || null) as BookingCustomerType | null } })}
              >
                <option value="">-</option>
                <option value="private">{t("Private", "Privat")}</option>
                <option value="business">{t("Business", "Bedrift")}</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>{t("Phone", "Telefon")}</span>
              <input className={fieldClass} value={details.customer.phone} onChange={(e) => updateDetails({ customer: { ...details.customer, phone: e.target.value } })} />
            </label>
            <label>
              <span className={labelClass}>{t("Email", "E-post")}</span>
              <input className={fieldClass} value={details.customer.email} onChange={(e) => updateDetails({ customer: { ...details.customer, email: e.target.value } })} />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>{t("Customer comments", "Kundens kommentar")}</span>
              <textarea
                rows={2}
                className={`${fieldClass} resize-none`}
                value={details.customer.comments}
                onChange={(e) => updateDetails({ customer: { ...details.customer, comments: e.target.value } })}
              />
            </label>
          </div>
        </section>
      </div>

      {/* The Overview's calculator (set to 0, discount, extra, partner minus/plus),
          priced together with the edits above and saved with them. */}
      <div className="flex flex-col gap-4 lg:self-start">
        {firstCalculator ? (
          <WebsiteOrderCalculator
            orderId={orderId}
            calculator={firstCalculator}
            adjustments={adjustments}
            missingFromLines={0}
            storedTotal={firstCalculator.customer.total}
            locale={locale}
            onChanged={() => {}}
            onDraftChange={setPricingDraft}
            externalPricing={{ view: preview?.calculator ?? null, previewing }}
          />
        ) : (
          <section className={sectionClass}>
            <p className="text-sm text-black/50">
              {previewing ? t("Calculating…", "Beregner…") : t("No price yet.", "Ingen pris ennå.")}
            </p>
          </section>
        )}

        {preview && (
          <section className={sectionClass}>
            <h3 className="text-lg font-semibold text-logoblue">{t("Payment", "Betaling")}</h3>
            <WebsiteOrderPaymentSummary
              comparison={preview.comparison}
              locale={locale}
              totalLabel={t("New total (incl. VAT)", "Ny total (inkl. MVA)")}
            />
          </section>
        )}

        <section className={sectionClass}>
          {blockers.length > 0 && (
            <ul className="list-disc pl-5 text-sm font-medium text-red-600">
              {blockers.map((blocker) => (
                <li key={blocker}>{blockerText(blocker)}</li>
              ))}
            </ul>
          )}
          {showError && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button
            type="button"
            className="customButtonEnabled h-11 disabled:opacity-50!"
            onClick={handleSave}
            disabled={!dirty || saving || blockers.length > 0}
          >
            {saving ? t("Saving…", "Lagrer…") : t("Save changes", "Lagre endringer")}
          </button>
          <button type="button" className="customButtonDefault h-11" onClick={onCancel} disabled={saving}>
            {t("Cancel", "Avbryt")}
          </button>
        </section>
      </div>
    </div>
  );
}

