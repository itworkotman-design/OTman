"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { WhiteGoodsProductCard } from "@/app/_components/site/BookingModal/whiteGoods/WhiteGoodsProductCard";
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
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import { isSizePricedProduct } from "@/lib/booking/pricing/sizeBrackets";
import { getVatBreakdown } from "@/lib/booking/pricing/vatDisplayTotal";
import { PRESET_TIME_WINDOWS } from "@/lib/booking/timeWindows";
import type { AdminOrderDetails } from "@/lib/orders/websiteOrderDetailsEdit";
import type { BookingCustomerType, BookingPickupSource } from "@/lib/orders/websiteBookingDetails";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import type { WebsiteOrderCalculatorView } from "@/lib/orders/websiteOrderCalculator";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";
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

const PREVIEW_DELAY_MS = 800;
const SOURCES: BookingPickupSource[] = ["store", "private", "business"];

function formatKr(n: number) {
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

// Customer amounts on these orders are stored VAT-inclusive; shown ex. VAT
// like the booking app's calculator.
function exVat(clientAmount: number) {
  return clientAmount / 1.25;
}

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

  const [preview, setPreview] = useState<{ comparison: OrderPaymentComparison; calculator: WebsiteOrderCalculatorView } | null>(null);
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
        setStops(loadedStops);
        setDetails(rest);
        setInitialKey(JSON.stringify({ cards: loadedCards, stops: loadedStops, details: rest }));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const currentKey = details ? JSON.stringify({ cards, stops, details }) : null;
  const dirty = !!initialKey && currentKey !== initialKey;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const payload = useMemo(() => {
    if (!details) return null;
    const saveDetails: AdminOrderDetails = { ...details, pickups: stopsForSave(stops, cardName), drivingDistanceOverride: null };
    return { productCards: cards, details: saveDetails };
    // cardName reads cards/catalogProducts, both already dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, stops, details, catalogProducts]);

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
  const blockerText = (blocker: EditorBlocker) => reasonText[blocker];

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
    const next = removeCardFromOrder(cards, stops, cardId);
    setCards(next.cards);
    setStops(next.stops);
  }

  function updateCard(next: SavedProductCard) {
    setCards((current) => current.map((card) => (card.cardId === next.cardId ? next : card)));
  }

  const vat = preview ? getVatBreakdown(preview.calculator.customer.total) : null;

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
                variantNumber={siblings.length > 1 ? siblings.indexOf(card) + 1 : undefined}
                headerExtra={
                  sizePriced ? null : (
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                      {t("Qty", "Antall")}
                      <input
                        type="number"
                        min={1}
                        className="h-8 w-16 rounded-lg border-0 bg-white px-2 text-sm text-black/85"
                        value={card.amount}
                        onChange={(e) => updateCard({ ...card, amount: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      />
                    </label>
                  )
                }
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
                    : undefined
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

      {/* Price after the changes, priced by the server */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
        <section className={sectionClass}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold text-logoblue">{t("Calculator", "Kalkulator")}</h3>
            {previewing && <span className="text-xs text-black/50">{t("Calculating…", "Beregner…")}</span>}
          </div>
          <p className="-mt-3 text-xs text-black/45">{t("Prices ex. VAT", "Priser eks. mva")}</p>
          {preview && vat ? (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
                {preview.calculator.products.map((product, i) => (
                  <Fragment key={i}>
                    <span className="col-span-2 mt-2 font-semibold text-black/80">
                      {product.isOrderExtras ? t("Order extras", "Tillegg til ordren") : product.name}
                    </span>
                    {product.lines.map((line, j) => (
                      <Fragment key={j}>
                        <span className="min-w-0 text-black/60 [overflow-wrap:anywhere]">
                          {line.qty > 1 && <span className="mr-1 opacity-70">x{line.qty}</span>}
                          {line.label}
                        </span>
                        <span className="text-right tabular-nums text-black/70">{formatKr(exVat(line.customer))}</span>
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-black/10 pt-3 text-sm text-black/70">
                {preview.calculator.customer.discount !== 0 && (
                  <div className="flex justify-between">
                    <span>{t("Discount", "Rabatt")}</span>
                    <span className="tabular-nums">-{formatKr(exVat(preview.calculator.customer.discount))}</span>
                  </div>
                )}
                {preview.calculator.customer.extra !== 0 && (
                  <div className="flex justify-between">
                    <span>{t("Extra", "Tillegg")}</span>
                    <span className="tabular-nums">
                      {preview.calculator.customer.extra > 0 ? "+" : ""}
                      {formatKr(exVat(preview.calculator.customer.extra))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 rounded-xl bg-logoblue/10 px-4 py-3">
                  <span className="font-semibold text-logoblue">{t("Total", "Totalt")}</span>
                  <span className="text-2xl font-bold tabular-nums text-logoblue">{formatKr(vat.exVat)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("VAT (25%)", "MVA (25%)")}</span>
                  <span className="tabular-nums">{formatKr(vat.vat)}</span>
                </div>
                <div className="flex justify-between font-semibold text-black/85">
                  <span>{t("Total incl. VAT", "Totalt inkl. MVA")}</span>
                  <span className="tabular-nums">{formatKr(vat.incVat)}</span>
                </div>
              </div>
              <div className="border-t border-black/10 pt-3">
                <WebsiteOrderPaymentSummary
                  comparison={preview.comparison}
                  locale={locale}
                  totalLabel={t("New total (incl. VAT)", "Ny total (inkl. MVA)")}
                />
              </div>
            </>
          ) : (
            !previewing && <p className="text-sm text-black/50">{t("No price yet.", "Ingen pris ennå.")}</p>
          )}
        </section>

        {preview?.calculator.partner && (
          <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800">{t("Partner view", "Partnervisning")}</h3>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
              {preview.calculator.products.map((product, i) => (
                <Fragment key={i}>
                  <span className="col-span-2 mt-2 font-semibold text-black/80">
                    {product.isOrderExtras ? t("Order extras", "Tillegg til ordren") : product.name}
                  </span>
                  {product.lines.map((line, j) => (
                    <Fragment key={j}>
                      <span className="min-w-0 text-black/60 [overflow-wrap:anywhere]">
                        {line.qty > 1 && <span className="mr-1 opacity-70">x{line.qty}</span>}
                        {line.label}
                      </span>
                      <span className="text-right tabular-nums text-black/70">{formatKr(line.partner ?? 0)}</span>
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </div>
            <div className="flex flex-col gap-2 border-t border-amber-200 pt-3 text-sm text-black/70">
              {preview.calculator.partner.minus !== 0 && (
                <div className="flex justify-between">
                  <span>{t("Minus", "Minus")}</span>
                  <span className="tabular-nums">-{formatKr(preview.calculator.partner.minus)}</span>
                </div>
              )}
              {preview.calculator.partner.plus !== 0 && (
                <div className="flex justify-between">
                  <span>{t("Plus", "Pluss")}</span>
                  <span className="tabular-nums">+{formatKr(preview.calculator.partner.plus)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <span className="text-base font-bold text-amber-900">{t("Total", "Totalt")}</span>
                <span className="text-2xl font-bold tabular-nums text-amber-900">{formatKr(preview.calculator.partner.total)}</span>
              </div>
            </div>
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
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
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

