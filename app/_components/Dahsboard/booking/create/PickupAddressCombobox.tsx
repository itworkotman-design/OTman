"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AddressAutocompleteInput, {
  type AddressSuggestion,
} from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { AddressSelectionMeta } from "@/lib/orders/addressPrecision";

export type CustomPickupAddressOption = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

function StorefrontIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M3.5 9h17l-.7 3.3a2 2 0 0 1-2 1.6 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-1.6z" />
      <path d="M5 14v6h14v-6" />
      <path d="M9.5 20v-4a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-textColorThird transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-logoblue"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SelectedAddressCard({
  id,
  title,
  subtitle,
  icon,
  open,
  onClick,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      aria-expanded={open}
      className="flex w-full items-center gap-3 rounded-xl border border-lineSecondary bg-white px-4 py-3 text-left hover:border-logoblue/40"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-logoblue/10 text-logoblue">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-black">{title}</span>
        {subtitle ? <span className="block truncate text-sm text-textColorSecond">{subtitle}</span> : null}
      </span>
      <ChevronIcon open={open} />
    </button>
  );
}

function SavedLocationRow({
  option,
  selected,
  onSelect,
}: {
  option: CustomPickupAddressOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${
        selected ? "bg-logoblue/10" : "hover:bg-black/5"
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-logoblue/10 text-logoblue">
        <StorefrontIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-black">{option.name}</span>
        <span className="block truncate text-sm text-textColorSecond">{option.address}</span>
      </span>
      {selected ? <CheckIcon /> : null}
    </button>
  );
}

function SuggestionRow({
  suggestion,
  precisionLabel,
  onSelect,
}: {
  suggestion: AddressSuggestion;
  precisionLabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/5"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-black">{suggestion.name}</span>
        {suggestion.subtitle ? (
          <span className="block truncate text-sm text-textColorSecond">{suggestion.subtitle}</span>
        ) : null}
      </span>
      <span
        className={`shrink-0 text-xs uppercase tracking-[0.12em] ${
          suggestion.precise ? "text-textColorSecond" : "text-amber-700"
        }`}
      >
        {precisionLabel}
      </span>
    </button>
  );
}

// Combined "saved pickup location" picker + free-text address search for the
// main pickup address field. Typing in the search box never touches parent
// state on its own — only an actual selection (a saved location row, or a
// geocoded suggestion) commits, so an abandoned search can't clobber an
// already-confirmed address. Geocoded suggestions and saved locations render
// in one scrollable, absolutely-positioned panel (not two stacked dropdowns)
// so opening it overlays the rest of the form instead of pushing it down.
export function PickupAddressCombobox({
  value,
  onChange,
  customPickupAddressId,
  onSelectCustomPickupAddress,
  placeholder,
  locale = "en",
}: {
  value: string;
  onChange: (value: string, wasSelected?: boolean, meta?: AddressSelectionMeta) => void;
  customPickupAddressId?: string | null;
  onSelectCustomPickupAddress: (address: CustomPickupAddressOption | null) => void;
  placeholder?: string;
  locale?: BookingUiLocale;
}) {
  const t = (text: string) => bookingText(locale, text);
  const [options, setOptions] = useState<CustomPickupAddressOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [addressResults, setAddressResults] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/pickup-addresses/available", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => null);

        if (!cancelled && res.ok && data?.ok) {
          setOptions(data.pickupAddresses ?? []);
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasConfirmedAddress = value.trim().length > 0;
  // With nothing confirmed yet there's no card to collapse into, so the
  // search panel stays open regardless of the `expanded` toggle.
  const panelVisible = !loadingOptions && options.length > 0 && (expanded || !hasConfirmedAddress);

  const collapse = () => {
    setExpanded(false);
    setSearchValue("");
    setAddressResults([]);
  };

  useEffect(() => {
    if (!panelVisible) return;

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        collapse();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelVisible]);

  // Mirrors AddressAutocompleteInput's own debounced Mapbox search, but
  // rendered inline below the saved-locations list instead of in a separate
  // floating dropdown.
  useEffect(() => {
    if (!panelVisible) {
      setAddressResults([]);
      return;
    }

    const trimmed = searchValue.trim();

    if (trimmed.length < 6) {
      setAddressResults([]);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setAddressLoading(true);

        if (!sessionTokenRef.current) sessionTokenRef.current = crypto.randomUUID();

        const res = await fetch(
          `/api/address-search?q=${encodeURIComponent(trimmed)}&sessionToken=${encodeURIComponent(sessionTokenRef.current)}`,
          { method: "GET", credentials: "include", signal: controller.signal },
        );

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setAddressResults([]);
          return;
        }

        setAddressResults(data.results ?? []);
      } catch {
        setAddressResults([]);
      } finally {
        setAddressLoading(false);
      }
    }, 1000);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchValue, panelVisible]);

  const selected = useMemo(
    () => (customPickupAddressId ? (options.find((o) => o.id === customPickupAddressId) ?? null) : null),
    [options, customPickupAddressId],
  );

  const filteredOptions = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.address.toLowerCase().includes(q),
    );
  }, [options, searchValue]);

  const selectOption = (option: CustomPickupAddressOption) => {
    onSelectCustomPickupAddress(option);
    collapse();
  };

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label, true, {
      featureType: suggestion.featureType,
      typedQuery: searchValue,
      precise: suggestion.precise,
    });
    onSelectCustomPickupAddress(null);
    sessionTokenRef.current = "";
    collapse();
  };

  const precisionLabel = (suggestion: AddressSuggestion) =>
    !suggestion.precise ? t("Approximate") : suggestion.featureType === "poi" ? t("Business") : t("Address");

  if (loadingOptions || options.length === 0) {
    return (
      <AddressAutocompleteInput
        inputId="order-pickup-address"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        locale={locale}
      />
    );
  }

  const hasResults = filteredOptions.length > 0 || addressResults.length > 0;
  const showNoResults = !addressLoading && !hasResults && searchValue.trim().length > 0;

  const resultsList = (
    <div className="max-h-72 overflow-auto">
      {addressLoading ? <div className="px-2 py-2 text-sm text-textColorSecond">{t("Searching...")}</div> : null}

      {!addressLoading && addressResults.length > 0
        ? addressResults.map((suggestion) => (
            <SuggestionRow
              key={suggestion.id}
              suggestion={suggestion}
              precisionLabel={precisionLabel(suggestion)}
              onSelect={() => selectSuggestion(suggestion)}
            />
          ))
        : null}

      {filteredOptions.length > 0 ? (
        <div className={addressResults.length > 0 ? "mt-2 border-t border-lineSecondary pt-2" : ""}>
          <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-textColorThird">
            {t("Saved locations")}
          </div>
          {filteredOptions.map((option) => (
            <SavedLocationRow
              key={option.id}
              option={option}
              selected={option.id === customPickupAddressId}
              onSelect={() => selectOption(option)}
            />
          ))}
        </div>
      ) : null}

      {showNoResults ? (
        <div className="px-2 py-2 text-sm text-textColorSecond">{t("No addresses found")}</div>
      ) : null}
    </div>
  );

  return (
    <div>
      <p className="mb-2 mt-0.5 text-sm text-textColorSecond">
        {t("Choose a saved location or enter another address")}
      </p>

      <div ref={containerRef} className="relative">
        {hasConfirmedAddress ? (
          <SelectedAddressCard
            id="order-pickup-address"
            title={selected ? selected.name : value}
            subtitle={selected ? selected.address : undefined}
            icon={selected ? <StorefrontIcon /> : <PinIcon />}
            open={expanded}
            onClick={() => (expanded ? collapse() : setExpanded(true))}
          />
        ) : (
          <input
            id="order-pickup-address"
            className="customInput w-full bg-white"
            value={searchValue}
            placeholder={t("Search saved locations or enter address...")}
            onFocus={() => setExpanded(true)}
            onChange={(e) => {
              setExpanded(true);
              setSearchValue(e.target.value);
            }}
            autoComplete="off"
          />
        )}

        {panelVisible ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-lineSecondary bg-white p-2 shadow-lg">
            {hasConfirmedAddress ? (
              <input
                className="customInput mb-2 w-full bg-white"
                value={searchValue}
                placeholder={t("Search saved locations or enter address...")}
                onChange={(e) => setSearchValue(e.target.value)}
                autoComplete="off"
              />
            ) : null}

            {resultsList}
          </div>
        ) : null}
      </div>
    </div>
  );
}
