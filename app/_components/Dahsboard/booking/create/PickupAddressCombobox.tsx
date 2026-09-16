"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AddressAutocompleteInput, {
  type AddressSuggestion,
} from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { ADDRESS_ICON_COMPONENTS, PinIcon, SearchIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { AddressSelectionMeta } from "@/lib/orders/addressPrecision";
import {
  ADDRESS_COLOR_CLASSES,
  DEFAULT_ADDRESS_COLOR,
  DEFAULT_ADDRESS_ICON,
  type AddressColorKey,
  type AddressIconKey,
} from "@/lib/pickupAddresses/addressAppearance";

export type CustomPickupAddressOption = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  icon: AddressIconKey;
  color: AddressColorKey;
};

const FEATURE_TYPE_RANK: Record<string, number> = {
  address: 0,
  poi: 1,
};

function sortSuggestions(results: AddressSuggestion[], prioritizeAddresses: boolean) {
  if (!prioritizeAddresses) {
    return results;
  }

  return [...results].sort(
    (a, b) => (FEATURE_TYPE_RANK[a.featureType] ?? 2) - (FEATURE_TYPE_RANK[b.featureType] ?? 2),
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
  colorClasses,
  open,
  onClick,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  colorClasses: { bg: string; text: string };
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
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${colorClasses.bg} ${colorClasses.text}`}>
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
  const Icon = ADDRESS_ICON_COMPONENTS[option.icon] ?? ADDRESS_ICON_COMPONENTS[DEFAULT_ADDRESS_ICON];
  const colorClasses = ADDRESS_COLOR_CLASSES[option.color] ?? ADDRESS_COLOR_CLASSES[DEFAULT_ADDRESS_COLOR];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${
        selected ? "bg-logoblue/10" : "hover:bg-black/5"
      }`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${colorClasses.bg} ${colorClasses.text}`}>
        <Icon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-black">{option.name}</span>
        <span className="block truncate text-sm text-textColorSecond">{option.address}</span>
      </span>
      {selected ? <CheckIcon /> : null}
    </button>
  );
}

function SearchField({
  id,
  value,
  placeholder,
  onChange,
  onFocus,
  className = "",
}: {
  id?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-textColorThird">
        <SearchIcon />
      </span>
      <input
        id={id}
        className="w-full rounded-xl border border-lineSecondary bg-white py-3 pl-11 pr-4 outline-none focus:border-logoblue/50"
        value={value}
        placeholder={placeholder}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
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
  inputId,
  value,
  onChange,
  customPickupAddressId,
  onSelectCustomPickupAddress,
  placeholder,
  locale = "en",
  prioritizeAddresses = false,
  allowSavedLocations = true,
}: {
  inputId: string;
  value: string;
  onChange: (value: string, wasSelected?: boolean, meta?: AddressSelectionMeta) => void;
  customPickupAddressId?: string | null;
  // Omit this when the caller has no id-based "main pickup address" concept
  // to update (e.g. an extra pickup row) — picking a saved location then
  // just commits its address text via onChange, same as a geocoded pick.
  onSelectCustomPickupAddress?: (address: CustomPickupAddressOption | null) => void;
  placeholder?: string;
  locale?: BookingUiLocale;
  // When set, geocoded addresses are listed before businesses/POIs (Mapbox's
  // own relevance ranking is kept within each group) — mirrors
  // AddressAutocompleteInput's own prop of the same name.
  prioritizeAddresses?: boolean;
  // Delivery addresses aren't saved pickup locations, but the field should
  // still get the same "confirmed address" card + pin icon treatment as the
  // saved-location fields — so this skips the saved-locations fetch/list
  // rather than falling back to the plainer AddressAutocompleteInput.
  allowSavedLocations?: boolean;
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
    if (!allowSavedLocations) {
      setLoadingOptions(false);
      return;
    }

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
  }, [allowSavedLocations]);

  const hasConfirmedAddress = value.trim().length > 0;
  // The search input itself (rendered below regardless of confirmation
  // state) is the closed-state trigger — the results panel only follows
  // `expanded`, so an empty field can still be closed without picking
  // something. When saved locations are disabled there's nothing to list
  // until a geocode search actually has something to show (or the field is
  // already confirmed, which renders its own embedded search box) — otherwise
  // focusing the empty field would pop an empty white panel.
  const panelVisible =
    !loadingOptions &&
    expanded &&
    (allowSavedLocations
      ? options.length > 0
      : hasConfirmedAddress || addressLoading || addressResults.length > 0 || searchValue.trim().length > 0);

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

        setAddressResults(sortSuggestions(data.results ?? [], prioritizeAddresses));
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
  }, [searchValue, panelVisible, prioritizeAddresses]);

  const selected = useMemo(
    () => (customPickupAddressId ? (options.find((o) => o.id === customPickupAddressId) ?? null) : null),
    [options, customPickupAddressId],
  );
  const SelectedIcon = selected
    ? (ADDRESS_ICON_COMPONENTS[selected.icon] ?? ADDRESS_ICON_COMPONENTS[DEFAULT_ADDRESS_ICON])
    : PinIcon;

  const filteredOptions = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.address.toLowerCase().includes(q),
    );
  }, [options, searchValue]);

  const selectOption = (option: CustomPickupAddressOption) => {
    if (onSelectCustomPickupAddress) {
      onSelectCustomPickupAddress(option);
    } else {
      // No id-based callback to update — commit the saved location's
      // address text directly, same as picking a geocoded suggestion.
      onChange(option.address, true, { featureType: "address", typedQuery: searchValue, precise: true });
    }
    collapse();
  };

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label, true, {
      featureType: suggestion.featureType,
      typedQuery: searchValue,
      precise: suggestion.precise,
    });
    onSelectCustomPickupAddress?.(null);
    sessionTokenRef.current = "";
    collapse();
  };

  const precisionLabel = (suggestion: AddressSuggestion) =>
    !suggestion.precise ? t("Approximate") : suggestion.featureType === "poi" ? t("Business") : t("Address");

  if (allowSavedLocations && (loadingOptions || options.length === 0)) {
    return (
      <AddressAutocompleteInput
        inputId={inputId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        locale={locale}
        icon={<SearchIcon />}
        prioritizeAddresses={prioritizeAddresses}
      />
    );
  }

  const hasResults = filteredOptions.length > 0 || addressResults.length > 0;
  const showNoResults = !addressLoading && !hasResults && searchValue.trim().length > 0;
  // "Search saved locations..." would be misleading once there are none to
  // search (e.g. delivery addresses) — fall back to the caller's own
  // placeholder, which now has to carry that meaning on its own since the
  // "Choose a saved location..." hint line above the field is gone.
  const searchPlaceholder = allowSavedLocations
    ? t("Search saved locations or enter address...")
    : (placeholder ?? t("Enter a location"));

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
      <div ref={containerRef} className="relative">
        {hasConfirmedAddress ? (
          <SelectedAddressCard
            id={inputId}
            title={selected ? selected.name : value}
            subtitle={selected ? selected.address : undefined}
            icon={<SelectedIcon />}
            colorClasses={selected ? ADDRESS_COLOR_CLASSES[selected.color] ?? ADDRESS_COLOR_CLASSES[DEFAULT_ADDRESS_COLOR] : ADDRESS_COLOR_CLASSES[DEFAULT_ADDRESS_COLOR]}
            open={expanded}
            onClick={() => (expanded ? collapse() : setExpanded(true))}
          />
        ) : (
          <SearchField
            id={inputId}
            value={searchValue}
            placeholder={searchPlaceholder}
            onFocus={() => setExpanded(true)}
            onChange={(next) => {
              setExpanded(true);
              setSearchValue(next);
            }}
          />
        )}

        {panelVisible ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-lineSecondary bg-white p-2 shadow-lg">
            {hasConfirmedAddress ? (
              <SearchField
                value={searchValue}
                placeholder={searchPlaceholder}
                onChange={setSearchValue}
                className="mb-2"
              />
            ) : null}

            {resultsList}
          </div>
        ) : null}
      </div>
    </div>
  );
}
