"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import GoogleMap from "@/app/_components/site/GoogleMap";
import {
  transportDimensionLimits,
  transportPackageTypes,
  transportTimeWindows,
} from "@/lib/content/TransportRequestConfig";
import type {
  Locale,
  ServiceGroup,
} from "@/lib/content/ServiceWindowContent";

type Props = { service: ServiceGroup; locale: Locale; onClose: () => void };
type BaseForm = { name: string; email: string; phone: string; notes: string };
type PkgDraft = {
  packageType: string;
  length: string;
  width: string;
  height: string;
  weight: string;
};
type PkgEntry = PkgDraft & { id: string };
type PkgField = keyof Omit<PkgDraft, "packageType">;
type CollectionForm = {
  pickupAddress: string;
  dropoffAddress: string;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupContactEmail: string;
  dropoffContactName: string;
  dropoffContactPhone: string;
  dropoffContactEmail: string;
  timeWindow: string;
  notes: string;
};
type TransportForm = BaseForm & {
  pickupAddress: string;
  deliveryAddress: string;
  preferredDate: string;
  timeWindow: string;
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

const pkg0: PkgDraft = {
  packageType: "",
  length: "",
  width: "",
  height: "",
  weight: "",
};
const collection0: CollectionForm = {
  pickupAddress: "",
  dropoffAddress: "",
  pickupContactName: "",
  pickupContactPhone: "",
  pickupContactEmail: "",
  dropoffContactName: "",
  dropoffContactPhone: "",
  dropoffContactEmail: "",
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

const inputCls =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-textColor outline-none transition placeholder:text-black/30 focus:border-logoblue/30 focus:ring-2 focus:ring-logoblue/10";

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
const n = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: number) =>
  `${new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} NOK`;

function HeaderBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-logoblue/70">
        {title}
      </h4>
      <p className="mt-2 max-w-lg text-sm leading-6 text-black/55">{body}</p>
    </div>
  );
}

export function ServiceModal({ service, locale, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const onOverlay = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={onOverlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091030]/45 px-4 py-6 backdrop-blur-sm"
    >
      <ServiceModalBody
        key={service.id}
        service={service}
        locale={locale}
        onClose={onClose}
      />
    </div>
  );
}

function ServiceModalBody({ service, locale, onClose }: Props) {
  const pkgFieldTimers = useRef<
    Partial<Record<PkgField, ReturnType<typeof setTimeout>>>
  >({});
  const initialCategoryId = firstCategory(service)?.id ?? "";
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialCategoryId,
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pkgDraft, setPkgDraft] = useState<PkgDraft>(pkg0);
  const [invalidPkgFields, setInvalidPkgFields] = useState<
    Partial<Record<PkgField, boolean>>
  >({});
  const [packages, setPackages] = useState<PkgEntry[]>([]);
  const [collection, setCollection] = useState<CollectionForm>(collection0);
  const [transport, setTransport] = useState<TransportForm>(transport0);
  const [manpower, setManpower] = useState<ManpowerForm>(manpower0);
  const [car, setCar] = useState<CarForm>(car0);

  useEffect(() => {
    const timers = pkgFieldTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const category =
    service.categories.find((item) => item.id === selectedCategoryId) ??
    firstCategory(service);
  const collectionPickup =
    service.formVariant === "transport" && category?.id === "collection-pickup";
  const sidebarCollapsed = !sidebarOpen;

  const collapseSidebarForCollectionProgress = () => {
    if (collectionPickup) {
      setSidebarOpen(false);
    }
  };

  const flashInvalidPkgField = (field: PkgField) => {
    const currentTimer = pkgFieldTimers.current[field];
    if (currentTimer) clearTimeout(currentTimer);
    setInvalidPkgFields((prev) => ({ ...prev, [field]: true }));
    pkgFieldTimers.current[field] = setTimeout(() => {
      setInvalidPkgFields((prev) => ({ ...prev, [field]: false }));
    }, 10000);
  };

  const handlePkgFieldChange = (field: PkgField, rawValue: string) => {
    if (!rawValue.trim()) {
      setPkgDraft((prev) => ({ ...prev, [field]: "" }));
      setInvalidPkgFields((prev) => ({ ...prev, [field]: false }));
      return;
    }

    const parsed = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setPkgDraft((prev) => ({ ...prev, [field]: rawValue }));
      return;
    }

    const limits = transportDimensionLimits[field];
    const clamped = Math.min(limits.max, Math.max(limits.min, parsed));
    const normalized = field === "weight" ? String(clamped) : String(Math.round(clamped));

    setPkgDraft((prev) => ({ ...prev, [field]: normalized }));
    if (clamped !== parsed) {
      flashInvalidPkgField(field);
      return;
    }
    setInvalidPkgFields((prev) => ({ ...prev, [field]: false }));
  };

  const canAddPackage =
    Boolean(pkgDraft.packageType) &&
    n(pkgDraft.length) >= transportDimensionLimits.length.min &&
    n(pkgDraft.length) <= transportDimensionLimits.length.max &&
    n(pkgDraft.width) >= transportDimensionLimits.width.min &&
    n(pkgDraft.width) <= transportDimensionLimits.width.max &&
    n(pkgDraft.height) >= transportDimensionLimits.height.min &&
    n(pkgDraft.height) <= transportDimensionLimits.height.max &&
    n(pkgDraft.weight) >= transportDimensionLimits.weight.min &&
    n(pkgDraft.weight) <= transportDimensionLimits.weight.max;

  const showLocation = packages.length > 0;
  const showTime =
    showLocation &&
    Boolean(collection.pickupAddress.trim()) &&
    Boolean(collection.dropoffAddress.trim()) &&
    Boolean(collection.pickupContactName.trim()) &&
    Boolean(collection.pickupContactPhone.trim()) &&
    Boolean(collection.dropoffContactName.trim()) &&
    Boolean(collection.dropoffContactPhone.trim());
  const canPlaceCollection =
    showTime &&
    Boolean(collection.timeWindow);

  const totals = useMemo(() => {
    const subtotal = packages.reduce((sum, item) => {
      const volume = n(item.length) * n(item.width) * n(item.height) * 0.0004;
      return sum + 350 + n(item.weight) * 2 + volume;
    }, 0);
    const vat = subtotal * 0.25;
    return { subtotal, vat, total: subtotal + vat };
  }, [packages]);

  const resetAndClose = () => {
    setPkgDraft(pkg0);
    setPackages([]);
    setCollection(collection0);
    setTransport(transport0);
    setManpower(manpower0);
    setCar(car0);
    onClose();
  };

  const calc = (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_20px_50px_rgba(39,48,151,0.10)]">
        <div className="border-b border-black/5 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-logoblue/55">
            {locale === "no" ? "Kalkulator" : "Calculator"}
          </p>
          <h4 className="mt-2 text-lg font-semibold text-logoblue">
            {locale === "no" ? "Prisoversikt" : "Price overview"}
          </h4>
        </div>
        <div className="space-y-4 px-5 py-5">
          {packages.length === 0 ? (
            <p className="text-sm leading-6 text-black/45">
              {locale === "no"
                ? "Legg til kolli for a se prisoversikt her. Logikken kan kobles pa senere."
                : "Add package entries to see the price summary here. Final logic can be connected later."}
            </p>
          ) : (
            packages.map((item) => (
              <div key={item.id} className="border-b border-black/5 pb-3 last:border-b-0">
                <p className="font-semibold text-logoblue">{item.packageType}</p>
                <p className="mt-1 text-sm text-black/55">{`${item.length} x ${item.width} x ${item.height} cm`}</p>
                <p className="text-sm text-black/55">{`${item.weight} kg`}</p>
              </div>
            ))
          )}
          <div className="rounded-2xl bg-[#f5f7ff] px-4 py-4 text-sm">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-semibold">{money(totals.subtotal)}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span>MVA (25%)</span>
              <span className="font-semibold">{money(totals.vat)}</span>
            </div>
            <div className="mt-2 flex justify-between text-base font-semibold text-logoblue">
              <span>{locale === "no" ? "Total inkl. MVA" : "Total incl. VAT"}</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const transportFormUi = collectionPickup ? (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        resetAndClose();
      }}
    >
      <div className="grid gap-6">
        {packages.length > 0 && (
          <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
            <h4 className="text-lg font-semibold text-logoblue">
              {locale === "no" ? "Valgte kolli" : "Added package entries"}
            </h4>
            <div className="mt-4 space-y-3">
              {packages.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-black/6 bg-[#f8faff] px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-logoblue">{`${index + 1}. ${item.packageType}`}</p>
                    <p className="mt-1 text-sm text-black/55">{`${item.length} x ${item.width} x ${item.height} cm, ${item.weight} kg`}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPackages((prev) =>
                        prev.filter((entry) => entry.id !== item.id),
                      )
                    }
                    className="text-sm font-semibold text-logoblue/65 transition hover:text-logoblue"
                  >
                    {locale === "no" ? "Fjern" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
          <HeaderBlock
            title={
              locale === "no" ? "1. Velg pakketype" : "1. Choose package type"
            }
            body={locale === "no" ? "Velg type kolli" : "Choose a package type"}
          />
          <div className="grid gap-4">
            <select
              className={inputCls}
              value={pkgDraft.packageType}
              onChange={(e) =>
                setPkgDraft((p) => ({ ...p, packageType: e.target.value }))
              }
            >
              <option value="">
                {locale === "no" ? "Pakketype" : "Package type"}
              </option>
              {transportPackageTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          {pkgDraft.packageType && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <input
                className={`${inputCls} ${invalidPkgFields.length ? "border-red-500 ring-2 ring-red-200" : ""}`}
                type="number"
                min={transportDimensionLimits.length.min}
                max={transportDimensionLimits.length.max}
                placeholder={
                  locale === "no"
                    ? `Lengde (${transportDimensionLimits.length.min}-${transportDimensionLimits.length.max} cm)`
                    : `Length (${transportDimensionLimits.length.min}-${transportDimensionLimits.length.max} cm)`
                }
                value={pkgDraft.length}
                onChange={(e) => handlePkgFieldChange("length", e.target.value)}
              />
              <input
                className={`${inputCls} ${invalidPkgFields.width ? "border-red-500 ring-2 ring-red-200" : ""}`}
                type="number"
                min={transportDimensionLimits.width.min}
                max={transportDimensionLimits.width.max}
                placeholder={
                  locale === "no"
                    ? `Bredde (${transportDimensionLimits.width.min}-${transportDimensionLimits.width.max} cm)`
                    : `Width (${transportDimensionLimits.width.min}-${transportDimensionLimits.width.max} cm)`
                }
                value={pkgDraft.width}
                onChange={(e) => handlePkgFieldChange("width", e.target.value)}
              />
              <input
                className={`${inputCls} ${invalidPkgFields.height ? "border-red-500 ring-2 ring-red-200" : ""}`}
                type="number"
                min={transportDimensionLimits.height.min}
                max={transportDimensionLimits.height.max}
                placeholder={
                  locale === "no"
                    ? `Hoyde (${transportDimensionLimits.height.min}-${transportDimensionLimits.height.max} cm)`
                    : `Height (${transportDimensionLimits.height.min}-${transportDimensionLimits.height.max} cm)`
                }
                value={pkgDraft.height}
                onChange={(e) => handlePkgFieldChange("height", e.target.value)}
              />
              <input
                className={`${inputCls} ${invalidPkgFields.weight ? "border-red-500 ring-2 ring-red-200" : ""}`}
                type="number"
                step="0.1"
                min={transportDimensionLimits.weight.min}
                max={transportDimensionLimits.weight.max}
                placeholder={
                  locale === "no"
                    ? `Vekt (${transportDimensionLimits.weight.min}-${transportDimensionLimits.weight.max} kg)`
                    : `Weight (${transportDimensionLimits.weight.min}-${transportDimensionLimits.weight.max} kg)`
                }
                value={pkgDraft.weight}
                onChange={(e) => handlePkgFieldChange("weight", e.target.value)}
              />
            </div>
          )}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-black/45">
              {locale === "no"
                ? "Du kan legge til flere kolli."
                : "You can add multiple package entries."}
            </p>
            <button
              type="button"
              disabled={!canAddPackage}
              onClick={() => {
                if (!canAddPackage) return;
                setPackages((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), ...pkgDraft },
                ]);
                setPkgDraft(pkg0);
                collapseSidebarForCollectionProgress();
              }}
              className="rounded-full bg-logoblue px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              {locale === "no" ? "Legg til" : "Add"}
            </button>
          </div>
        </div>

        {showLocation && (
          <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-logoblue/70 mb-2">
              {locale === "no"
                ? "2. Lokasjon og kontakt"
                : "2. Location and contact"}
            </h4>
            <div className="grid gap-4">
              <AddressAutocompleteInput
                value={collection.pickupAddress}
                onChange={(value) => {
                  setCollection((p) => ({ ...p, pickupAddress: value }));
                  if (value.trim()) {
                    collapseSidebarForCollectionProgress();
                  }
                }}
                placeholder={
                  locale === "no" ? "Henteadresse" : "Pickup address"
                }
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <input
                  className={inputCls}
                  placeholder={
                    locale === "no" ? "Kontaktperson henting" : "Pickup contact"
                  }
                  value={collection.pickupContactName}
                  onChange={(e) =>
                    setCollection((p) => ({
                      ...p,
                      pickupContactName: e.target.value,
                    }))
                  }
                />
                <input
                  className={inputCls}
                  placeholder={
                    locale === "no" ? "Telefon henting" : "Pickup phone"
                  }
                  value={collection.pickupContactPhone}
                  onChange={(e) =>
                    setCollection((p) => ({
                      ...p,
                      pickupContactPhone: e.target.value,
                    }))
                  }
                />
                <input
                  className={inputCls}
                  placeholder={
                    locale === "no" ? "E-post henting" : "Pickup email"
                  }
                  value={collection.pickupContactEmail}
                  onChange={(e) =>
                    setCollection((p) => ({
                      ...p,
                      pickupContactEmail: e.target.value,
                    }))
                  }
                />
              </div>
              <AddressAutocompleteInput
                value={collection.dropoffAddress}
                onChange={(value) => {
                  setCollection((p) => ({ ...p, dropoffAddress: value }));
                  if (value.trim()) {
                    collapseSidebarForCollectionProgress();
                  }
                }}
                placeholder={
                  locale === "no" ? "Leveringsadresse" : "Drop-off address"
                }
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <input
                  className={inputCls}
                  placeholder={
                    locale === "no"
                      ? "Kontaktperson levering"
                      : "Drop-off contact"
                  }
                  value={collection.dropoffContactName}
                  onChange={(e) =>
                    setCollection((p) => ({
                      ...p,
                      dropoffContactName: e.target.value,
                    }))
                  }
                />
                <input
                  className={inputCls}
                  placeholder={
                    locale === "no" ? "Telefon levering" : "Drop-off phone"
                  }
                  value={collection.dropoffContactPhone}
                  onChange={(e) =>
                    setCollection((p) => ({
                      ...p,
                      dropoffContactPhone: e.target.value,
                    }))
                  }
                />
                <input
                  className={inputCls}
                  placeholder={
                    locale === "no" ? "E-post levering" : "Drop-off email"
                  }
                  value={collection.dropoffContactEmail}
                  onChange={(e) =>
                    setCollection((p) => ({
                      ...p,
                      dropoffContactEmail: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-[24] border border-black/6 bg-[#f4f6ff]">
              <div className="border-b border-black/5 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-logoblue/55">
                  {locale === "no" ? "Rutekart" : "Route map"}
                </p>
                <h4 className="mt-2 text-lg font-semibold text-logoblue">
                  {locale === "no"
                    ? "Viser start- og sluttpunkt for leveringen"
                    : "Showing delivery start and end points"}
                </h4>
              </div>
              <div className="h-[260] w-full bg-[#f4f6ff]">
                <GoogleMap />
              </div>
            </div>
          </div>
        )}

        {showTime && (
          <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
            <HeaderBlock
              title={locale === "no" ? "3. Tidspunkt" : "3. Timing"}
              body={
                locale === "no"
                  ? "Velg tidsvindu og legg ved eventuell beskrivelse."
                  : "Choose the delivery window and add any optional description."
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {transportTimeWindows.map((window) => {
                const active = collection.timeWindow === window;
                return (
                  <button
                    key={window}
                    type="button"
                    onClick={() =>
                      setCollection((p) => ({ ...p, timeWindow: window }))
                    }
                    className={`rounded-2xl border px-4 py-4 text-left transition ${active ? "border-logoblue bg-logoblue text-white" : "border-black/8 bg-[#f8faff] text-logoblue"}`}
                  >
                    <p className="font-semibold">{window}</p>
                  </button>
                );
              })}
            </div>
            <textarea
              className={`${inputCls} mt-4 min-h-[132] resize-none`}
              placeholder={
                locale === "no"
                  ? "Ekstra informasjon om adgang, etasje eller skjore varer."
                  : "Extra details about access, floors, or fragile goods."
              }
              value={collection.notes}
              onChange={(e) => {
                setCollection((p) => ({ ...p, notes: e.target.value }));
                if (e.target.value.trim()) {
                  collapseSidebarForCollectionProgress();
                }
              }}
            />
            {canPlaceCollection && (
              <button
                type="submit"
                className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-logoblue px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                {locale === "no" ? "Legg inn ordre" : "Place an order"}
              </button>
            )}
          </div>
        )}
      </div>
      {calc}
    </form>
  ) : (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        resetAndClose();
      }}
    >
      {service.formVariant === "transport" ? (
        <>
          <HeaderBlock
            title={locale === "no" ? "Transportvalg" : "Transport selection"}
            body={category?.description[locale] ?? ""}
          />
          <input
            className={inputCls}
            placeholder={locale === "no" ? "Henteadresse" : "Pickup address"}
            value={transport.pickupAddress}
            onChange={(e) =>
              setTransport((p) => ({ ...p, pickupAddress: e.target.value }))
            }
          />
          <input
            className={inputCls}
            placeholder={
              locale === "no" ? "Leveringsadresse" : "Delivery address"
            }
            value={transport.deliveryAddress}
            onChange={(e) =>
              setTransport((p) => ({ ...p, deliveryAddress: e.target.value }))
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className={inputCls}
              type="date"
              value={transport.preferredDate}
              onChange={(e) =>
                setTransport((p) => ({ ...p, preferredDate: e.target.value }))
              }
            />
            <input
              className={inputCls}
              placeholder={locale === "no" ? "Tidsvindu" : "Time window"}
              value={transport.timeWindow}
              onChange={(e) =>
                setTransport((p) => ({ ...p, timeWindow: e.target.value }))
              }
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-full bg-logoblue px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {locale === "no" ? "Send foresporsel" : "Send request"}
          </button>
        </>
      ) : service.formVariant === "manpower" ? (
        <>
          <HeaderBlock
            title={locale === "no" ? "Bemanningsbehov" : "Crew request"}
            body={category?.description[locale] ?? ""}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className={inputCls}
              placeholder={locale === "no" ? "Antall personer" : "Crew size"}
              value={manpower.crewSize}
              onChange={(e) =>
                setManpower((p) => ({ ...p, crewSize: e.target.value }))
              }
            />
            <input
              className={inputCls}
              placeholder={locale === "no" ? "Timer behov" : "Hours needed"}
              value={manpower.hoursNeeded}
              onChange={(e) =>
                setManpower((p) => ({ ...p, hoursNeeded: e.target.value }))
              }
            />
          </div>
          <input
            className={inputCls}
            placeholder={locale === "no" ? "Oppdragssted" : "Job location"}
            value={manpower.location}
            onChange={(e) =>
              setManpower((p) => ({ ...p, location: e.target.value }))
            }
          />
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-full bg-logoblue px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {locale === "no" ? "Send foresporsel" : "Send request"}
          </button>
        </>
      ) : (
        <>
          <HeaderBlock
            title={locale === "no" ? "Leieoppsett" : "Rental setup"}
            body={category?.description[locale] ?? ""}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className={inputCls}
              placeholder={
                locale === "no" ? "Hentested / avdeling" : "Pickup location"
              }
              value={car.pickupLocation}
              onChange={(e) =>
                setCar((p) => ({ ...p, pickupLocation: e.target.value }))
              }
            />
            <input
              className={inputCls}
              type="date"
              value={car.rentalStart}
              onChange={(e) =>
                setCar((p) => ({ ...p, rentalStart: e.target.value }))
              }
            />
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
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/70 bg-white/90 text-logoblue shadow-sm transition hover:rotate-90"
        aria-label="Close modal"
      >
        <span className="text-xl leading-none">x</span>
      </button>
      <div
        className={`grid max-h-[92vh] overflow-y-auto ${sidebarCollapsed ? "lg:grid-cols-[40px_minmax(0,1fr)]" : "lg:grid-cols-[320px_minmax(0,1fr)]"}`}
      >
        <aside
          className={`relative overflow-hidden bg-logoblue text-white transition-all duration-300 ${sidebarCollapsed ? "w-[40] px-0 py-0" : "px-6 py-8"}`}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />
            {!sidebarCollapsed && (
              <div className="relative">
                <div className="mb-0 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="grid h-6 w-6 place-items-center text-white transition hover:font-bold cursor-pointer"
                    aria-label={
                      locale === "no" ? "Lukk kategorier" : "Close categories"
                    }
                  >
                    <span className="rotate-180 text-lg leading-none">
                      {">"}
                    </span>
                  </button>
                </div>
                <div>
                  <h2 className="mt-4 max-w-[12ch] text-3xl font-semibold leading-tight">
                    {service.modalTitle[locale]}
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-white/76">
                    {service.modalIntro[locale]}
                  </p>
                </div>
                <div className="mt-8 space-y-3">
                  {service.categories.map((item) => {
                    const active = item.id === category?.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(item.id)}
                        className={`w-full rounded-[24] border px-4 py-4 text-left transition ${active ? "border-white bg-white text-logoblue shadow-lg" : "border-white/12 bg-white/8 text-white hover:bg-white/12"}`}
                      >
                        <p className="text-sm font-semibold">
                          {item.title[locale]}
                        </p>
                        <p
                          className={`mt-2 text-sm leading-5 ${active ? "text-logoblue/72" : "text-white/68"}`}
                        >
                          {item.description[locale]}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="relative flex h-full w-[40] mt-6 items-start justify-center py-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="grid h-6 w-6 place-items-center text-white transition hover:font-bold cursor-pointer"
                  aria-label={
                    locale === "no" ? "Apne kategorier" : "Open categories"
                  }
                >
                  <span className="text-lg leading-none">{">"}</span>
                </button>
              </div>
            )}
        </aside>
        <section className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="mb-8 flex items-start justify-between gap-5 rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_18px_50px_rgba(39,48,151,0.08)]">
            <div>
              <h3 className="mt-3 text-2xl font-semibold text-logoblue">
                {category?.title[locale]}
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-black/60">
                {category?.description[locale]}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-18 w-18 shrink-0 place-items-center rounded-[22px] bg-[#f3f6ff] ring-1 ring-logoblue/8">
                <Image
                  src={categoryIcon(category?.id)}
                  alt={category?.title[locale] ?? service.title[locale]}
                  width={52}
                  height={52}
                />
              </div>
            </div>
          </div>
          {transportFormUi}
        </section>
      </div>
    </div>
  );
}
