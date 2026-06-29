"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { transportTimeWindows, TRANSPORT_PACKAGE_PRICELIST_ID } from "@/lib/content/TransportRequestConfig";
import type { Locale, ServiceGroup } from "@/lib/content/ServiceWindowContent";
import { ProductCardNew } from "@/app/_components/Dahsboard/booking/create/ProductCard";
import { CalculatorDisplayNew } from "@/app/_components/Dahsboard/booking/create/CalculatorDisplay";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { buildCalculatorBreakdownsWithOrderExtras, parseDistanceKm, parsePriceSetting } from "@/lib/booking/pricing/orderCalculatorExtras";
import {
  createEmptyProductCard,
  type SavedProductCard,
  type CatalogProduct,
  type CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import { CloseButton } from "../../utils/CloseButton";
import { createDefaultPriceListSettings, normalizePriceListSettings, type PriceListSettings } from "@/lib/products/priceListSettings";

type Props = { service: ServiceGroup; locale: Locale; onClose: () => void };
type BaseForm = { name: string; email: string; phone: string; notes: string };
type CollectionForm = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupContactEmail: string;
  dropoffContactName: string;
  dropoffContactPhone: string;
  dropoffContactEmail: string;
  preferredDate: string;
  timeWindow: string;
  notes: string;
};
type TransportForm = BaseForm & {
  pickupAddress: string;
  deliveryAddress: string;
  preferredDate: string;
  timeWindow: string;
  squareMeters: string;
  sizeWm: string;
  sizeWcm: string;
  sizeHm: string;
  sizeHcm: string;
  sizeLm: string;
  sizeLcm: string;
  weight: string;
  units: string;
};
type ManpowerForm = BaseForm & {
  crewSize: string;
  hoursNeeded: string;
  location: string;
};
type CarForm = BaseForm & {
  pickupLocation: string;
  rentalStart: string;
  rentalLength: string;
  transmission: string;
};

type CollectionErrors = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  products?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupContactPhone?: string;
  pickupContactEmail?: string;
  dropoffContactPhone?: string;
  dropoffContactEmail?: string;
  preferredDate?: string;
  timeWindow?: string;
};
type TransportErrors = {
  phone?: string;
  email?: string;
};

const collection0: CollectionForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  pickupAddress: "",
  dropoffAddress: "",
  pickupContactName: "",
  pickupContactPhone: "",
  pickupContactEmail: "",
  dropoffContactName: "",
  dropoffContactPhone: "",
  dropoffContactEmail: "",
  preferredDate: "",
  timeWindow: "",
  notes: "",
};
const transport0: TransportForm = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  pickupAddress: "",
  deliveryAddress: "",
  preferredDate: "",
  timeWindow: "",
  squareMeters: "",
  sizeWm: "",
  sizeWcm: "",
  sizeHm: "",
  sizeHcm: "",
  sizeLm: "",
  sizeLcm: "",
  weight: "",
  units: "",
};
const manpower0: ManpowerForm = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  crewSize: "",
  hoursNeeded: "",
  location: "",
};
const car0: CarForm = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  pickupLocation: "",
  rentalStart: "",
  rentalLength: "",
  transmission: "",
};

const METER_OPTIONS = Array.from({ length: 11 }, (_, i) => i);
const CM_OPTIONS = [0, 20, 40, 60, 80];
const WEIGHT_OPTIONS = ["Under 10 kg", "Under 30 kg", "Under 50 kg", "Under 100 kg", "Over 100 kg"];
const M2_OPTIONS = ["Under 20 m²", "Under 40 m²", "Under 60 m²", "Under 100 m²", "Over 100 m²"];

function DimensionSelect({
  label,
  meters,
  cm,
  onMeters,
  onCm,
}: {
  label: string;
  meters: string;
  cm: string;
  onMeters: (v: string) => void;
  onCm: (v: string) => void;
}) {
  const sel =
    "w-full rounded-xl border border-black/10 bg-white px-2 py-2 text-sm text-center text-textColor outline-none transition focus:border-logoblue/30 focus:ring-2 focus:ring-logoblue/10";
  return (
    <div className="flex w-full items-center gap-4">
      <span className="w-16 shrink-0 text-sm text-black/55">{label}</span>
      <div className="flex flex-1 min-w-0 items-center gap-1.5">
        <select value={meters} onChange={(e) => onMeters(e.target.value)} className={sel}>
          <option value="">—</option>
          {METER_OPTIONS.map((m) => (
            <option key={m} value={String(m)}>
              {m}
            </option>
          ))}
        </select>
        <span className="text-xs font-medium text-black/40">m</span>
      </div>
      <div className="flex flex-1 min-w-0 items-center gap-1.5">
        <select value={cm} onChange={(e) => onCm(e.target.value)} className={sel}>
          <option value="">—</option>
          {CM_OPTIONS.map((c) => (
            <option key={c} value={String(c)}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs font-medium text-black/40">cm</span>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-textColor outline-none transition placeholder:text-black/30 focus:border-logoblue/30 focus:ring-2 focus:ring-logoblue/10";
const inputErrCls =
  "w-full rounded-2xl border border-red-400 bg-white px-4 py-3 text-sm text-textColor outline-none transition placeholder:text-black/30 focus:border-red-400 focus:ring-2 focus:ring-red-100";

const PHONE_RE = /^\+?\d{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISALLOWED_RE = /[<>'"`;\\{}[\]]/g;

function sanitizeText(v: string) {
  return v.replace(DISALLOWED_RE, "");
}

function sanitizePhone(v: string) {
  return v.replace(/[^\d+]/g, "");
}

function sanitizeName(v: string) {
  return v.replace(/[^\p{L}\s]/gu, "");
}

function sanitizeInteger(v: string) {
  return v.replace(/\D/g, "");
}

function validatePhone(v: string, locale: Locale): string | null {
  const t = v.trim();
  if (!t) return null;
  return PHONE_RE.test(t) ? null : locale === "no" ? "Ugyldig telefonnummer" : "Invalid phone number";
}

function validateEmail(v: string, locale: Locale): string | null {
  const t = v.trim();
  if (!t) return null;
  return EMAIL_RE.test(t) ? null : locale === "no" ? "Ugyldig e-postadresse" : "Invalid email address";
}

const firstCategory = (service: ServiceGroup) => service.categories[0] ?? null;
const categoryIcon = (categoryId?: string | null) => {
  switch (categoryId) {
    case "collection-pickup":
      return "/Service logos-01.svg";
    case "package-delivery":
      return "/Service logos-02.svg";
    case "moving-relocation":
      return "/Service logos-03.svg";
    case "custom-transport":
      return "/Service logos-04.svg";
    default:
      return "/Service logos-01.svg";
  }
};

const toBookingLocale = (l: Locale): BookingUiLocale => (l === "no" ? "nb" : "en");

function HeaderBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-logoblue/70">{title}</h4>
      <p className="mt-2 max-w-lg text-sm leading-6 text-black/55">{body}</p>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

export function ServiceModal({ service, locale, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091030]/45 px-4 py-6 backdrop-blur-sm">
      <ServiceModalBody key={service.id} service={service} locale={locale} onClose={onClose} />
    </div>
  );
}

function ServiceModalBody({ service, locale, onClose }: Props) {
  const [collection, setCollection] = useState<CollectionForm>(collection0);
  const [transport, setTransport] = useState<TransportForm>(transport0);
  const [manpower, setManpower] = useState<ManpowerForm>(manpower0);
  const [car, setCar] = useState<CarForm>(car0);
  const [collectionErrors, setCollectionErrors] = useState<CollectionErrors>({});
  const [transportErrors, setTransportErrors] = useState<TransportErrors>({});
  const [sameAsCustomer, setSameAsCustomer] = useState(false);
  const [sameAsDropoff, setSameAsDropoff] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogSpecialOptions, setCatalogSpecialOptions] = useState<CatalogSpecialOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [priceListSettings, setPriceListSettings] = useState<PriceListSettings>(createDefaultPriceListSettings());
  const [productCards, setProductCards] = useState<SavedProductCard[]>([createEmptyProductCard(0)]);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(0);
  const [drivingDistance, setDrivingDistance] = useState("");
  const [expressDelivery, setExpressDelivery] = useState(false);
  const [extraPickupAddresses, setExtraPickupAddresses] = useState<string[]>([]);
  const nextCardId = useRef(1);
  const distanceAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (service.formVariant !== "transport") return;
    const controller = new AbortController();
    const load = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const res = await fetch(`/api/booking/catalog?priceListId=${encodeURIComponent(TRANSPORT_PACKAGE_PRICELIST_ID)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        setCatalogProducts(data.products ?? []);
        setCatalogSpecialOptions(data.specialOptions ?? []);
        setPriceListSettings(normalizePriceListSettings(data.priceListSettings));
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setCatalogError("Could not load product catalog");
        }
      } finally {
        setCatalogLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [service.formVariant]);

  useEffect(() => {
    const date = collection.preferredDate;
    const timeWindow = collection.timeWindow;
    if (!date) {
      setExpressDelivery(false);
      return;
    }
    const startHH = timeWindow === "16:00-21:00" ? 16 : 10;
    const deliveryStart = new Date(`${date}T${String(startHH).padStart(2, "0")}:00:00`);
    const diffHours = (deliveryStart.getTime() - Date.now()) / (1000 * 60 * 60);
    setExpressDelivery(diffHours < 24);
  }, [collection.preferredDate, collection.timeWindow]);

  useEffect(() => {
    if (sameAsCustomer) {
      setCollection((p) => ({
        ...p,
        pickupContactName: p.customerName,
        pickupContactPhone: p.customerPhone,
        pickupContactEmail: p.customerEmail,
      }));
    } else {
      setCollection((p) => ({ ...p, pickupContactName: "", pickupContactPhone: "", pickupContactEmail: "" }));
    }
  }, [sameAsCustomer, collection.customerName, collection.customerPhone, collection.customerEmail]);

  useEffect(() => {
    if (sameAsDropoff) {
      setCollection((p) => ({
        ...p,
        dropoffContactName: p.customerName,
        dropoffContactPhone: p.customerPhone,
        dropoffContactEmail: p.customerEmail,
      }));
    } else {
      setCollection((p) => ({ ...p, dropoffContactName: "", dropoffContactPhone: "", dropoffContactEmail: "" }));
    }
  }, [sameAsDropoff, collection.customerName, collection.customerPhone, collection.customerEmail]);

  useEffect(() => {
    const pickup = collection.pickupAddress.trim();
    const dropoff = collection.dropoffAddress.trim();

    if (!pickup || !dropoff) {
      setDrivingDistance("");
      return;
    }

    distanceAbortRef.current?.abort();
    const controller = new AbortController();
    distanceAbortRef.current = controller;

    const filledExtras = extraPickupAddresses.filter((a) => a.trim().length > 0);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/site/route-distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pickupAddress: pickup, extraPickupAddresses: filledExtras, deliveryAddress: dropoff }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && typeof data.distanceKm === "string") {
          setDrivingDistance(data.distanceKm);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [collection.pickupAddress, collection.dropoffAddress, extraPickupAddresses]);

  const priceLookup = useMemo(() => buildPriceLookup(catalogProducts, catalogSpecialOptions), [catalogProducts, catalogSpecialOptions]);
  const productBreakdowns = useMemo(
    () =>
      buildProductBreakdowns(productCards, catalogProducts, catalogSpecialOptions, {
        zeroBaseDeliveryPricesOver100Km: parseDistanceKm(drivingDistance) > 100,
        xtraPalletPrice: parsePriceSetting(priceListSettings.xtraPallet.price),
        xtraPalletSubcontractorPrice: parsePriceSetting(priceListSettings.xtraPallet.subcontractorPrice),
      }),
    [productCards, catalogProducts, catalogSpecialOptions, drivingDistance, priceListSettings.xtraPallet.price, priceListSettings.xtraPallet.subcontractorPrice],
  );
  const calculatorBreakdowns = useMemo(
    () =>
      buildCalculatorBreakdownsWithOrderExtras({
        productBreakdowns,
        priceListSettings,
        deviation: "",
        drivingDistance,
        expressDelivery,
        extraWorkMinutes: 0,
        feeAddToOrder: false,
        feeExtraWork: false,
        extraPickups: extraPickupAddresses.map((address) => ({ address })),
        shouldUseNativeDistancePricing: true,
      }),
    [productBreakdowns, priceListSettings, drivingDistance, expressDelivery, extraPickupAddresses],
  );

  const category = firstCategory(service);
  const collectionPickup = service.formVariant === "transport" && category?.id === "collection-pickup";
  const updateProductCard = (cardId: number, next: SavedProductCard) => {
    setProductCards((prev) => prev.map((c) => (c.cardId === cardId ? next : c)));
  };

  const removeProductCard = (cardId: number) => {
    setProductCards((prev) => prev.filter((c) => c.cardId !== cardId));
    setExpandedCardId((curr) => (curr === cardId ? null : curr));
  };

  const addProductCard = () => {
    const id = nextCardId.current++;
    setProductCards((prev) => [...prev, createEmptyProductCard(id)]);
    setExpandedCardId(id);
  };


  const resetAndClose = () => {
    setCollection(collection0);
    setTransport(transport0);
    setManpower(manpower0);
    setCar(car0);
    setCollectionErrors({});
    setTransportErrors({});
    setSameAsCustomer(false);
    setSameAsDropoff(false);
    setSubmitLoading(false);
    setSubmitError(null);
    setProductCards([createEmptyProductCard(0)]);
    setExpandedCardId(0);
    setDrivingDistance("");
    setExpressDelivery(false);
    setExtraPickupAddresses([]);
    nextCardId.current = 1;
    onClose();
  };

  const handleCollectionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: CollectionErrors = {};
    const req = () => (locale === "no" ? "Påkrevd" : "Required");

    // 1. Your information — all required
    if (!collection.customerName.trim()) errs.customerName = req();
    if (!collection.customerPhone.trim()) {
      errs.customerPhone = req();
    } else {
      const err = validatePhone(collection.customerPhone, locale);
      if (err) errs.customerPhone = err;
    }
    if (!collection.customerEmail.trim()) {
      errs.customerEmail = req();
    } else {
      const err = validateEmail(collection.customerEmail, locale);
      if (err) errs.customerEmail = err;
    }

    // At least 1 product selected
    if (!productCards.some((c) => c.productId !== null)) {
      errs.products = locale === "no" ? "Velg minst ett produkt" : "Select at least one product";
    }

    // 2. Location — addresses required, phone required, email optional
    if (!collection.pickupAddress.trim()) errs.pickupAddress = req();
    if (!collection.dropoffAddress.trim()) errs.dropoffAddress = req();
    if (!collection.pickupContactPhone.trim()) {
      errs.pickupContactPhone = req();
    } else {
      const err = validatePhone(collection.pickupContactPhone, locale);
      if (err) errs.pickupContactPhone = err;
    }
    if (!collection.dropoffContactPhone.trim()) {
      errs.dropoffContactPhone = req();
    } else {
      const err = validatePhone(collection.dropoffContactPhone, locale);
      if (err) errs.dropoffContactPhone = err;
    }
    const peErr = validateEmail(collection.pickupContactEmail, locale);
    if (peErr) errs.pickupContactEmail = peErr;
    const deErr = validateEmail(collection.dropoffContactEmail, locale);
    if (deErr) errs.dropoffContactEmail = deErr;

    // 3. Timing — date and time window required
    if (!collection.preferredDate) errs.preferredDate = req();
    if (!collection.timeWindow) errs.timeWindow = locale === "no" ? "Velg et tidsvindu" : "Select a time window";

    if (Object.keys(errs).length > 0) {
      setCollectionErrors(errs);
      return;
    }
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/site/transport-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formType: "collection", categoryId: category?.id ?? "", ...collection, extraPickupAddresses, productCards, drivingDistance, expressDelivery }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.reason === "RATE_LIMIT_DAILY") {
          setSubmitError(
            locale === "no"
              ? "Vi har registrert et uvanlig høyt antall innkommende bestillinger og har midlertidig stanset ordrebehandlingen. Vennligst ta kontakt med oss direkte."
              : "We have detected an unusually high volume of incoming orders and have temporarily paused the order form. Please reach out to us directly.",
          );
        } else if (data.reason === "RATE_LIMIT_MINUTE") {
          setSubmitError(locale === "no" ? "Vennligst vent litt før du sender inn igjen." : "Please wait a moment before submitting again.");
        } else {
          if (data.errors) setCollectionErrors(data.errors as CollectionErrors);
          setSubmitError(locale === "no" ? "Noe gikk galt. Prøv igjen." : "Something went wrong. Please try again.");
        }
        return;
      }
    } catch {
      setSubmitError(locale === "no" ? "Noe gikk galt. Prøv igjen." : "Something went wrong. Please try again.");
      return;
    } finally {
      setSubmitLoading(false);
    }
    resetAndClose();
  };

  const handleTransportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: TransportErrors = {};
    if (!transport.phone.trim()) {
      errs.phone = locale === "no" ? "Påkrevd" : "Required";
    } else {
      const err = validatePhone(transport.phone, locale);
      if (err) errs.phone = err;
    }
    const emailErr = validateEmail(transport.email, locale);
    if (emailErr) errs.email = emailErr;
    if (Object.keys(errs).length > 0) {
      setTransportErrors(errs);
      return;
    }
    setSubmitLoading(true);
    setSubmitError(null);
    const fmtDim = (m: string, c: string) => (m || c ? `${m || "0"}m ${c || "0"}cm` : "");
    try {
      const res = await fetch("/api/site/transport-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "transport",
          categoryId: category?.id ?? "",
          name: transport.name,
          email: transport.email,
          phone: transport.phone,
          notes: transport.notes,
          pickupAddress: transport.pickupAddress,
          deliveryAddress: transport.deliveryAddress,
          preferredDate: transport.preferredDate,
          timeWindow: transport.timeWindow,
          squareMeters: transport.squareMeters,
          sizeW: fmtDim(transport.sizeWm, transport.sizeWcm),
          sizeH: fmtDim(transport.sizeHm, transport.sizeHcm),
          sizeL: fmtDim(transport.sizeLm, transport.sizeLcm),
          weight: transport.weight,
          units: transport.units,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.reason === "RATE_LIMIT_DAILY") {
          setSubmitError(
            locale === "no"
              ? "Vi har registrert et uvanlig høyt antall innkommende bestillinger og har midlertidig stanset ordrebehandlingen. Vennligst ta kontakt med oss direkte."
              : "We have detected an unusually high volume of incoming orders and have temporarily paused the order form. Please reach out to us directly.",
          );
        } else if (data.reason === "RATE_LIMIT_MINUTE") {
          setSubmitError(locale === "no" ? "Vennligst vent litt før du sender inn igjen." : "Please wait a moment before submitting again.");
        } else {
          if (data.errors?.phone) setTransportErrors((p) => ({ ...p, phone: String(data.errors.phone) }));
          if (data.errors?.email) setTransportErrors((p) => ({ ...p, email: String(data.errors.email) }));
          setSubmitError(locale === "no" ? "Noe gikk galt. Prøv igjen." : "Something went wrong. Please try again.");
        }
        return;
      }
    } catch {
      setSubmitError(locale === "no" ? "Noe gikk galt. Prøv igjen." : "Something went wrong. Please try again.");
      return;
    } finally {
      setSubmitLoading(false);
    }
    resetAndClose();
  };

  const transportFormUi = collectionPickup ? (
    <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" onSubmit={handleCollectionSubmit}>
      <div className="grid gap-6">
        <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-logoblue/70 mb-4">
            {locale === "no" ? "Dine opplysninger" : "Your information"}
          </h4>
          <div className="grid gap-3">
            <div>
              <input
                className={collectionErrors.customerName ? inputErrCls : inputCls}
                placeholder={locale === "no" ? "Fullt navn" : "Full name"}
                value={collection.customerName}
                onChange={(e) => {
                  setCollection((p) => ({ ...p, customerName: sanitizeName(e.target.value) }));
                  if (e.target.value.trim()) setCollectionErrors((p) => ({ ...p, customerName: undefined }));
                }}
              />
              <FieldError message={collectionErrors.customerName} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <input
                  className={collectionErrors.customerPhone ? inputErrCls : inputCls}
                  placeholder={locale === "no" ? "Telefon" : "Phone"}
                  value={collection.customerPhone}
                  inputMode="tel"
                  onChange={(e) => {
                    const v = sanitizePhone(e.target.value);
                    setCollection((p) => ({ ...p, customerPhone: v }));
                    setCollectionErrors((p) => ({ ...p, customerPhone: validatePhone(v, locale) ?? undefined }));
                  }}
                />
                <FieldError message={collectionErrors.customerPhone} />
              </div>
              <div>
                <input
                  className={collectionErrors.customerEmail ? inputErrCls : inputCls}
                  placeholder={locale === "no" ? "E-post" : "Email"}
                  value={collection.customerEmail}
                  onChange={(e) => {
                    const v = sanitizeText(e.target.value);
                    setCollection((p) => ({ ...p, customerEmail: v }));
                    setCollectionErrors((p) => ({ ...p, customerEmail: validateEmail(v, locale) ?? undefined }));
                  }}
                />
                <FieldError message={collectionErrors.customerEmail} />
              </div>
            </div>
          </div>
        </div>

        {productCards.map((card, index) => (
          <ProductCardNew
            key={card.cardId}
            cardId={card.cardId}
            displayIndex={index + 1}
            value={card}
            catalogProducts={catalogProducts}
            catalogSpecialOptions={catalogSpecialOptions}
            loading={catalogLoading}
            error={catalogError}
            onChange={(next) => updateProductCard(card.cardId, next)}
            onRemove={removeProductCard}
            disableRemove={productCards.length === 1}
            isExpanded={expandedCardId === card.cardId}
            onToggle={() => setExpandedCardId((curr) => (curr === card.cardId ? null : card.cardId))}
            locale={toBookingLocale(locale)}
          />
        ))}

        <button
          type="button"
          onClick={addProductCard}
          className="flex items-center gap-2 rounded-full customContainer bg-white px-5 py-2.5 text-sm font-semibold text-logoblue transition hover:bg-logoblue/5"
        >
          <span className="text-lg leading-none">+</span>
          {locale === "no" ? "Legg til produkt" : "Add product"}
        </button>
        <FieldError message={collectionErrors.products} />

        <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-logoblue/70 mb-4">
              {locale === "no" ? "Lokasjon og kontakt" : "Location and contact"}
            </h4>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{locale === "no" ? "Henting" : "Pickup"}</p>
                <AddressAutocompleteInput
                  value={collection.pickupAddress}
                  onChange={(value) => {
                    setCollection((p) => ({ ...p, pickupAddress: sanitizeText(value) }));
                  }}
                  placeholder={locale === "no" ? "Henteadresse" : "Pickup address"}
                />
                <FieldError message={collectionErrors.pickupAddress} />
                {extraPickupAddresses.map((addr, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1">
                      <AddressAutocompleteInput
                        value={addr}
                        onChange={(value) => setExtraPickupAddresses((prev) => prev.map((a, idx) => (idx === i ? sanitizeText(value) : a)))}
                        placeholder={locale === "no" ? `Ekstra hentested ${i + 2}` : `Extra pickup ${i + 2}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setExtraPickupAddresses((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-black/40 transition hover:border-red-300 hover:text-red-500"
                      aria-label={locale === "no" ? "Fjern" : "Remove"}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setExtraPickupAddresses((prev) => [...prev, ""])}
                  className="self-start flex items-center gap-1.5 text-xs font-semibold text-logoblue/70 transition hover:text-logoblue"
                >
                  <span className="text-base leading-none">+</span>
                  {locale === "no" ? "Legg til hentested" : "Add pickup location"}
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 py-1">
                <input type="checkbox" checked={sameAsCustomer} onChange={(e) => setSameAsCustomer(e.target.checked)} className="h-4 w-4 accent-logoblue" />
                <span className="text-sm text-black/60">{locale === "no" ? "Fyll ut med mine opplysninger" : "Autofill with my details"}</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <input
                    className={inputCls}
                    placeholder={locale === "no" ? "Kontaktperson henting" : "Pickup contact"}
                    value={collection.pickupContactName}
                    readOnly={sameAsCustomer}
                    onChange={(e) => !sameAsCustomer && setCollection((p) => ({ ...p, pickupContactName: sanitizeName(e.target.value) }))}
                  />
                </div>
                <div>
                  <input
                    className={collectionErrors.pickupContactPhone ? inputErrCls : inputCls}
                    placeholder={locale === "no" ? "Telefon henting" : "Pickup phone"}
                    value={collection.pickupContactPhone}
                    inputMode="tel"
                    readOnly={sameAsCustomer}
                    onChange={(e) => {
                      if (sameAsCustomer) return;
                      const v = sanitizePhone(e.target.value);
                      setCollection((p) => ({ ...p, pickupContactPhone: v }));
                      setCollectionErrors((p) => ({ ...p, pickupContactPhone: validatePhone(v, locale) ?? undefined }));
                    }}
                  />
                  <FieldError message={collectionErrors.pickupContactPhone} />
                </div>
                <div>
                  <input
                    className={collectionErrors.pickupContactEmail ? inputErrCls : inputCls}
                    placeholder={locale === "no" ? "E-post henting" : "Pickup email"}
                    value={collection.pickupContactEmail}
                    readOnly={sameAsCustomer}
                    onChange={(e) => {
                      if (sameAsCustomer) return;
                      const v = sanitizeText(e.target.value);
                      setCollection((p) => ({ ...p, pickupContactEmail: v }));
                      setCollectionErrors((p) => ({ ...p, pickupContactEmail: validateEmail(v, locale) ?? undefined }));
                    }}
                  />
                  <FieldError message={collectionErrors.pickupContactEmail} />
                </div>
              </div>
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{locale === "no" ? "Levering" : "Drop-off"}</p>
                <AddressAutocompleteInput
                  value={collection.dropoffAddress}
                  onChange={(value) => {
                    setCollection((p) => ({ ...p, dropoffAddress: sanitizeText(value) }));
                  }}
                  placeholder={locale === "no" ? "Leveringsadresse" : "Drop-off address"}
                />
                <FieldError message={collectionErrors.dropoffAddress} />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 py-1">
                <input type="checkbox" checked={sameAsDropoff} onChange={(e) => setSameAsDropoff(e.target.checked)} className="h-4 w-4 accent-logoblue" />
                <span className="text-sm text-black/60">{locale === "no" ? "Fyll ut med mine opplysninger" : "Autofill with my details"}</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <input
                    className={inputCls}
                    placeholder={locale === "no" ? "Kontaktperson levering" : "Drop-off contact"}
                    value={collection.dropoffContactName}
                    readOnly={sameAsDropoff}
                    onChange={(e) => !sameAsDropoff && setCollection((p) => ({ ...p, dropoffContactName: sanitizeName(e.target.value) }))}
                  />
                </div>
                <div>
                  <input
                    className={collectionErrors.dropoffContactPhone ? inputErrCls : inputCls}
                    placeholder={locale === "no" ? "Telefon levering" : "Drop-off phone"}
                    value={collection.dropoffContactPhone}
                    inputMode="tel"
                    readOnly={sameAsDropoff}
                    onChange={(e) => {
                      if (sameAsDropoff) return;
                      const v = sanitizePhone(e.target.value);
                      setCollection((p) => ({ ...p, dropoffContactPhone: v }));
                      setCollectionErrors((p) => ({ ...p, dropoffContactPhone: validatePhone(v, locale) ?? undefined }));
                    }}
                  />
                  <FieldError message={collectionErrors.dropoffContactPhone} />
                </div>
                <div>
                  <input
                    className={collectionErrors.dropoffContactEmail ? inputErrCls : inputCls}
                    placeholder={locale === "no" ? "E-post levering" : "Drop-off email"}
                    value={collection.dropoffContactEmail}
                    readOnly={sameAsDropoff}
                    onChange={(e) => {
                      if (sameAsDropoff) return;
                      const v = sanitizeText(e.target.value);
                      setCollection((p) => ({ ...p, dropoffContactEmail: v }));
                      setCollectionErrors((p) => ({ ...p, dropoffContactEmail: validateEmail(v, locale) ?? undefined }));
                    }}
                  />
                  <FieldError message={collectionErrors.dropoffContactEmail} />
                </div>
              </div>
            </div>
          </div>

        <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
            <HeaderBlock
              title={locale === "no" ? "Tidspunkt" : "Timing"}
              body={
                locale === "no"
                  ? "Velg ønsket dato og tidsvindu, og legg ved eventuell beskrivelse."
                  : "Pick a preferred date and delivery window, then add any optional notes."
              }
            />
            <input
              type="date"
              className={collectionErrors.preferredDate ? inputErrCls : inputCls}
              value={collection.preferredDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setCollection((p) => ({ ...p, preferredDate: e.target.value }));
                if (e.target.value) setCollectionErrors((p) => ({ ...p, preferredDate: undefined }));
              }}
            />
            <FieldError message={collectionErrors.preferredDate} />
            <div className="grid gap-3 sm:grid-cols-2 mt-4">
              {transportTimeWindows.map((window) => {
                const active = collection.timeWindow === window;
                return (
                  <button
                    key={window}
                    type="button"
                    onClick={() => {
                      setCollection((p) => ({ ...p, timeWindow: window }));
                      setCollectionErrors((p) => ({ ...p, timeWindow: undefined }));
                    }}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${active ? "border-logoblue bg-logoblue text-white" : collectionErrors.timeWindow ? "border-red-400 bg-[#f8faff] text-logoblue" : "border-black/8 bg-[#f8faff] text-logoblue"}`}
                  >
                    <p className="font-semibold">{window.replace(/:00/g, "")}</p>
                  </button>
                );
              })}
            </div>
            <FieldError message={collectionErrors.timeWindow} />
            <textarea
              className={`${inputCls} mt-4 min-h-[132] resize-none`}
              placeholder={
                locale === "no" ? "Ekstra informasjon om adgang, etasje eller skjore varer." : "Extra details about access, floors, or fragile goods."
              }
              value={collection.notes}
              onChange={(e) => {
                setCollection((p) => ({ ...p, notes: sanitizeText(e.target.value) }));
              }}
            />
            {submitError && <p className="mt-3 text-sm text-red-500">{submitError}</p>}
            <button
              type="submit"
              disabled={submitLoading}
              className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-logoblue px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
            >
              {submitLoading ? (locale === "no" ? "Sender..." : "Sending...") : locale === "no" ? "Legg inn ordre" : "Place an order"}
            </button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_20px_50px_rgba(39,48,151,0.10)]">
          <CalculatorDisplayNew
            productBreakdowns={calculatorBreakdowns}
            priceLookup={priceLookup}
            adminView={false}
            sidebarMode
            locale={toBookingLocale(locale)}
          />
        </div>
      </div>
    </form>
  ) : (
    <form
      className="grid gap-6"
      onSubmit={
        service.formVariant === "transport"
          ? handleTransportSubmit
          : (e) => {
              e.preventDefault();
              resetAndClose();
            }
      }
    >
      {service.formVariant === "transport" ? (
        <>
          <HeaderBlock title={locale === "no" ? "Transportvalg" : "Transport selection"} body={category?.description[locale] ?? ""} />
          <section className="flex flex-col gap-3">
            <input
              className={inputCls}
              placeholder={locale === "no" ? "Navn" : "Name"}
              value={transport.name}
              onChange={(e) => setTransport((p) => ({ ...p, name: sanitizeName(e.target.value) }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <input
                  className={transportErrors.phone ? inputErrCls : inputCls}
                  placeholder={locale === "no" ? "Telefon" : "Phone"}
                  value={transport.phone}
                  inputMode="tel"
                  onChange={(e) => {
                    const v = sanitizePhone(e.target.value);
                    setTransport((p) => ({ ...p, phone: v }));
                    setTransportErrors((p) => ({ ...p, phone: validatePhone(v, locale) ?? undefined }));
                  }}
                />
                <FieldError message={transportErrors.phone} />
              </div>
              <div>
                <input
                  className={transportErrors.email ? inputErrCls : inputCls}
                  placeholder={locale === "no" ? "E-post" : "Email"}
                  value={transport.email}
                  onChange={(e) => {
                    const v = sanitizeText(e.target.value);
                    setTransport((p) => ({ ...p, email: v }));
                    setTransportErrors((p) => ({ ...p, email: validateEmail(v, locale) ?? undefined }));
                  }}
                />
                <FieldError message={transportErrors.email} />
              </div>
            </div>
            <textarea
              className={`${inputCls} min-h-[100] resize-none`}
              placeholder={locale === "no" ? "Ekstra informasjon" : "Additional notes"}
              value={transport.notes}
              onChange={(e) => setTransport((p) => ({ ...p, notes: sanitizeText(e.target.value) }))}
            />
            <div className="flex gap-3">
              <AddressAutocompleteInput
                value={transport.pickupAddress}
                onChange={(value) => setTransport((p) => ({ ...p, pickupAddress: sanitizeText(value) }))}
                placeholder={locale === "no" ? "Henteadresse" : "Pickup address"}
              />
              <AddressAutocompleteInput
                value={transport.deliveryAddress}
                onChange={(value) => setTransport((p) => ({ ...p, deliveryAddress: sanitizeText(value) }))}
                placeholder={locale === "no" ? "Leveringsadresse" : "Delivery address"}
              />
            </div>
          </section>

          {category?.id === "moving-relocation" && (
            <select className={inputCls} value={transport.squareMeters} onChange={(e) => setTransport((p) => ({ ...p, squareMeters: e.target.value }))}>
              <option value="">{locale === "no" ? "Omtrentlig areal (valgfri)" : "Approximate area (optional)"}</option>
              {M2_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          {category?.id === "custom-transport" && (
            <>
              <div>
                <section className="flex flex-col md:flex-row gap-6 w-full">
                  <div className="flex flex-col gap-3 w-full">
                    <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-black/40">
                      {locale === "no" ? "Mål (valgfri)" : "Dimensions (optional)"}
                    </p>
                    <DimensionSelect
                      label={locale === "no" ? "Bredde" : "Width"}
                      meters={transport.sizeWm}
                      cm={transport.sizeWcm}
                      onMeters={(v) => setTransport((p) => ({ ...p, sizeWm: v }))}
                      onCm={(v) => setTransport((p) => ({ ...p, sizeWcm: v }))}
                    />
                    <DimensionSelect
                      label={locale === "no" ? "Høyde" : "Height"}
                      meters={transport.sizeHm}
                      cm={transport.sizeHcm}
                      onMeters={(v) => setTransport((p) => ({ ...p, sizeHm: v }))}
                      onCm={(v) => setTransport((p) => ({ ...p, sizeHcm: v }))}
                    />
                    <DimensionSelect
                      label={locale === "no" ? "Lengde" : "Length"}
                      meters={transport.sizeLm}
                      cm={transport.sizeLcm}
                      onMeters={(v) => setTransport((p) => ({ ...p, sizeLm: v }))}
                      onCm={(v) => setTransport((p) => ({ ...p, sizeLcm: v }))}
                    />
                    <div className="flex w-full gap-3 pt-1">
                      <select
                        className="flex-1 min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-textColor outline-none transition focus:border-logoblue/30 focus:ring-2 focus:ring-logoblue/10"
                        value={transport.weight}
                        onChange={(e) => setTransport((p) => ({ ...p, weight: e.target.value }))}
                      >
                        <option value="">{locale === "no" ? "Vekt (valgfri)" : "Weight (optional)"}</option>
                        {WEIGHT_OPTIONS.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                      <input
                        className="flex-1 min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-textColor outline-none transition placeholder:text-black/30 focus:border-logoblue/30 focus:ring-2 focus:ring-logoblue/10"
                        inputMode="numeric"
                        placeholder={locale === "no" ? "Antall enheter (valgfri)" : "Units (optional)"}
                        value={transport.units}
                        onChange={(e) => setTransport((p) => ({ ...p, units: sanitizeInteger(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="w-full flex flex-col gap-4 ">
                    <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-black/40">
                      {locale === "no" ? "Leveringsdato" : "Delivery Date"}
                    </p>
                    <input
                      className={inputCls}
                      type="date"
                      value={transport.preferredDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setTransport((p) => ({ ...p, preferredDate: e.target.value }))}
                    />
                    {transportTimeWindows.map((window) => {
                      const active = transport.timeWindow === window;
                      return (
                        <button
                          key={window}
                          type="button"
                          onClick={() => setTransport((p) => ({ ...p, timeWindow: window }))}
                          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition w-full ${active ? "border-logoblue bg-logoblue text-white" : "border-black/8 bg-white! text-logoblue"}`}
                        >
                          {window}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]"></div>

          {submitError && <p className="text-sm text-red-500">{submitError}</p>}
          <button
            type="submit"
            disabled={submitLoading}
            className="inline-flex h-12 items-center justify-center rounded-full bg-logoblue px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
          >
            {submitLoading ? (locale === "no" ? "Sender..." : "Sending...") : locale === "no" ? "Send forespørsel" : "Send request"}
          </button>
        </>
      ) : service.formVariant === "manpower" ? (
        <>
          <HeaderBlock title={locale === "no" ? "Bemanningsbehov" : "Crew request"} body={category?.description[locale] ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className={inputCls}
              placeholder={locale === "no" ? "Antall personer" : "Crew size"}
              value={manpower.crewSize}
              onChange={(e) => setManpower((p) => ({ ...p, crewSize: sanitizeText(e.target.value) }))}
            />
            <input
              className={inputCls}
              placeholder={locale === "no" ? "Timer behov" : "Hours needed"}
              value={manpower.hoursNeeded}
              onChange={(e) => setManpower((p) => ({ ...p, hoursNeeded: sanitizeText(e.target.value) }))}
            />
          </div>
          <input
            className={inputCls}
            placeholder={locale === "no" ? "Oppdragssted" : "Job location"}
            value={manpower.location}
            onChange={(e) => setManpower((p) => ({ ...p, location: sanitizeText(e.target.value) }))}
          />
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-full bg-logoblue px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {locale === "no" ? "Send forespørsel" : "Send request"}
          </button>
        </>
      ) : (
        <>
          <HeaderBlock title={locale === "no" ? "Leieoppsett" : "Rental setup"} body={category?.description[locale] ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className={inputCls}
              placeholder={locale === "no" ? "Hentested / avdeling" : "Pickup location"}
              value={car.pickupLocation}
              onChange={(e) => setCar((p) => ({ ...p, pickupLocation: sanitizeText(e.target.value) }))}
            />
            <input className={inputCls} type="date" value={car.rentalStart} onChange={(e) => setCar((p) => ({ ...p, rentalStart: e.target.value }))} />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-full bg-logoblue px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {locale === "no" ? "Be om tilbud" : "Request quote"}
          </button>
        </>
      )}
    </form>
  );

  return (
    <div className="relative max-h-[92vh] w-full max-w-[1500] overflow-hidden rounded-[32] bg-[#f6f8ff] shadow-[0_32px_100px_rgba(9,16,48,0.28)]">
      <CloseButton onClose={onClose} />
      <div className="max-h-[92vh] overflow-y-auto">
        <section className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="mb-8 flex items-start justify-between gap-5 rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
            <div>
              <h3 className="mt-3 text-2xl font-semibold text-logoblue">{category?.title[locale]}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-black/60">{category?.description[locale]}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-18 w-18 shrink-0 place-items-center rounded-[22px] bg-[#f3f6ff] ring-1 ring-logoblue/8">
                <Image src={categoryIcon(category?.id)} alt={category?.title[locale] ?? service.title[locale]} width={52} height={52} />
              </div>
            </div>
          </div>
          {transportFormUi}
        </section>
      </div>
    </div>
  );
}
