"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AddressSuggestion } from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import type { AddressSelectionMeta } from "@/lib/orders/addressPrecision";
import { retrieveAddressCoordinate } from "@/lib/orders/retrieveAddressCoordinate";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { ADDRESS_ICON_COMPONENTS } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import {
  ADDRESS_COLOR_CLASSES,
  DEFAULT_ADDRESS_COLOR,
  DEFAULT_ADDRESS_ICON,
  isAddressColorKey,
  isAddressIconKey,
} from "@/lib/pickupAddresses/addressAppearance";
import { matchSavedPickupAddresses, type SavedPickupAddress } from "./matchSavedPickupAddresses";

// Small colored icon badge, same allow-list the dashboard's saved-locations
// list uses — falls back to the default icon/color if the DB ever holds
// something outside the allow-list.
function SavedAddressIcon({ icon, color }: { icon: string; color: string }) {
  const iconKey = isAddressIconKey(icon) ? icon : DEFAULT_ADDRESS_ICON;
  const colorKey = isAddressColorKey(color) ? color : DEFAULT_ADDRESS_COLOR;
  const Icon = ADDRESS_ICON_COMPONENTS[iconKey];
  const colorClasses = ADDRESS_COLOR_CLASSES[colorKey];

  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${colorClasses.bg} ${colorClasses.text}`}>
      <Icon />
    </span>
  );
}

type Props = {
  value: string;
  onChange: (value: string, wasSelected?: boolean, meta?: AddressSelectionMeta) => void;
  placeholder?: string;
  disabled?: boolean;
  inputId?: string;
  locale?: BookingUiLocale;
  icon?: ReactNode;
  hasError?: boolean;
  onBlur?: () => void;
};

// Same address-search UX as AddressAutocompleteInput (Mapbox suggestions,
// debounced, session-token'd coordinate backfill) — kept as its own copy
// rather than a change to that shared component, since this one also checks
// the public site's saved pickup locations (GET /api/site/pickup-addresses,
// e.g. known store branches) first. A name-or-address match is shown as the
// top suggestion(s), with the ordinary Mapbox results underneath; with no
// match, this behaves exactly like the plain autocomplete.
export default function PickupAddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter a location",
  disabled = false,
  inputId,
  locale,
  icon,
  hasError = false,
  onBlur,
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedPickupAddress[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const selectionTokenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/site/pickup-addresses")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok) setSavedAddresses(data.addresses ?? []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (value === query) {
      return;
    }

    setQuery(value);
    setOpen(false);

    if (!value.trim()) {
      setHasInteracted(false);
      sessionTokenRef.current = "";
    }
  }, [value, query]);

  const getSessionToken = () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = crypto.randomUUID();
    }

    return sessionTokenRef.current;
  };

  const commitSelection = () => {
    setResults([]);
    setOpen(false);
    setHasInteracted(false);
    sessionTokenRef.current = "";
    inputRef.current?.blur();
  };

  const selectSaved = (saved: SavedPickupAddress) => {
    selectionTokenRef.current += 1;
    onChange(saved.address, true, {
      featureType: "address",
      typedQuery: query,
      precise: true,
    });
    setQuery(saved.address);
    commitSelection();
  };

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    const sessionToken = sessionTokenRef.current;
    const typedQuery = query;
    const token = ++selectionTokenRef.current;

    onChange(suggestion.label, true, {
      featureType: suggestion.featureType,
      typedQuery,
      precise: suggestion.precise,
    });
    setQuery(suggestion.label);
    commitSelection();

    // Backfills the coordinate once Mapbox's retrieve call resolves — never
    // blocks committing the address text itself on this network round trip.
    // Dropped if the user has since typed or picked something else.
    retrieveAddressCoordinate(suggestion.id, sessionToken).then((coordinate) => {
      if (!coordinate || selectionTokenRef.current !== token) return;

      onChange(suggestion.label, true, {
        featureType: suggestion.featureType,
        typedQuery,
        precise: suggestion.precise,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
    });
  };

  useEffect(() => {
    if (disabled) {
      setResults([]);
      setOpen(false);
      return;
    }

    const trimmed = query.trim();

    if (!hasInteracted || trimmed.length < 6) {
      setResults([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `/api/address-search?q=${encodeURIComponent(trimmed)}&sessionToken=${encodeURIComponent(getSessionToken())}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          },
        );

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setResults([]);
          setOpen(false);
          return;
        }

        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 1000);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, disabled, hasInteracted]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Gated on hasInteracted, same as the Mapbox fetch below — otherwise a
  // just-selected saved address (now sitting in `query` as plain text)
  // would trivially match its own address field and reopen the panel right
  // after commitSelection() closed it.
  const matchedSaved = hasInteracted ? matchSavedPickupAddresses(query, savedAddresses) : [];
  // Independent of `open` (which only the Mapbox-fetch path drives) — a
  // saved match can show up well before a query is long enough to trigger
  // that fetch. With no match, the panel's visibility/content is exactly
  // what AddressAutocompleteInput does on its own.
  const showPanel = !disabled && (open || matchedSaved.length > 0);

  return (
    <div className="relative w-full" ref={boxRef}>
      {icon ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-textColorThird">
          {icon}
        </span>
      ) : null}
      <input
        id={inputId}
        ref={inputRef}
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          selectionTokenRef.current += 1;
          setHasInteracted(true);
          setQuery(next);
          onChange(next, false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !showPanel) return;
          event.preventDefault();
          if (matchedSaved.length > 0) selectSaved(matchedSaved[0]);
          else if (results.length > 0) selectSuggestion(results[0]);
        }}
        onFocus={() => {
          if (query.trim().length >= 3) {
            setHasInteracted(true);
          }
        }}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={
          icon
            ? [
                "w-full rounded-xl border bg-white py-3 pl-11 pr-4 outline-none disabled:opacity-60",
                hasError ? "border-red-400 ring-2 ring-red-100 focus:border-red-400" : "border-lineSecondary focus:border-logoblue/50",
              ].join(" ")
            : "customInput bg-white w-full"
        }
        autoComplete="off"
      />

      {showPanel && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-72 overflow-auto">
          {matchedSaved.length > 0 && (
            <div className={open ? "border-b border-black/10 pb-1" : ""}>
              <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-textColorThird">
                {t("Saved locations")}
              </div>
              {matchedSaved.map((saved) => (
                <button
                  key={saved.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/5"
                  onClick={() => selectSaved(saved)}
                >
                  <SavedAddressIcon icon={saved.icon} color={saved.color} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-black">{saved.name}</span>
                    <span className="block truncate text-sm text-textColorSecond">{saved.address}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {open && (
            <>
              {loading && (
                <div className="px-3 py-2 text-sm text-textColorSecond">{t("Searching...")}</div>
              )}

              {!loading && results.length === 0 && (
                <div className="px-3 py-2 text-sm text-textColorSecond">{t("No addresses found")}</div>
              )}

              {!loading &&
                results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-black/5"
                    onClick={() => selectSuggestion(item)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-black">{item.name}</div>
                        {item.subtitle ? (
                          <div className="truncate text-sm text-textColorSecond">{item.subtitle}</div>
                        ) : null}
                      </div>
                      <div
                        className={`shrink-0 text-xs uppercase tracking-[0.12em] ${
                          item.precise ? "text-textColorSecond" : "text-amber-700"
                        }`}
                      >
                        {!item.precise
                          ? t("Approximate")
                          : item.featureType === "poi"
                            ? t("Business")
                            : t("Address")}
                      </div>
                    </div>
                  </button>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
