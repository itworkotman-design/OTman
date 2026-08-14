"use client";

import React, { useEffect, useRef, useState } from "react";
import type { AddressSelectionMeta } from "@/lib/orders/addressPrecision";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type AddressSuggestion = {
  id: string;
  label: string;
  name: string;
  subtitle: string;
  featureType: string;
  precise: boolean;
};

type Props = {
  value: string;
  onChange: (value: string, wasSelected?: boolean, meta?: AddressSelectionMeta) => void;
  placeholder?: string;
  disabled?: boolean;
  inputId?: string;
  locale?: BookingUiLocale;
  // When set, addresses are listed before businesses/POIs (Mapbox's own
  // relevance ranking is kept within each group).
  prioritizeAddresses?: boolean;
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

export default function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = "Enter a location",
  disabled = false,
  inputId,
  locale,
  prioritizeAddresses = false,
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef("");
  const [hasInteracted, setHasInteracted] = useState(false);

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

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label, true, {
      featureType: suggestion.featureType,
      typedQuery: query,
      precise: suggestion.precise,
    });
    setQuery(suggestion.label);
    setResults([]);
    setOpen(false);
    setHasInteracted(false);
    sessionTokenRef.current = "";
    inputRef.current?.blur();
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

        setResults(sortSuggestions(data.results ?? [], prioritizeAddresses));
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
  }, [query, disabled, hasInteracted, prioritizeAddresses]);

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

  return (
    <div className="relative w-full" ref={boxRef}>
      <input
        id={inputId}
        ref={inputRef}
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setHasInteracted(true);
          setQuery(next);
          onChange(next, false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && open && results.length > 0) {
            event.preventDefault();
            selectSuggestion(results[0]);
          }
        }}
        onFocus={() => {
          if (query.trim().length >= 3) {
            setHasInteracted(true);
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        className="customInput bg-white w-full"
        autoComplete="off"
      />

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-72 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-textColorSecond">
              {t("Searching...")}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-textColorSecond">
              {t("No addresses found")}
            </div>
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
                    <div className="truncate font-medium text-black">
                      {item.name}
                    </div>
                    {item.subtitle ? (
                      <div className="truncate text-sm text-textColorSecond">
                        {item.subtitle}
                      </div>
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
        </div>
      )}
    </div>
  );
}
