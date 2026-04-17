"use client";

import React, { useEffect, useRef, useState } from "react";

type AddressSuggestion = {
  id: string;
  label: string;
  name: string;
  subtitle: string;
  featureType: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = "Enter a location",
  disabled = false,
}: Props) {
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
    onChange(suggestion.label);
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

    if (!hasInteracted || trimmed.length < 3) {
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
    }, 250);

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

  return (
    <div className="relative w-full" ref={boxRef}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setHasInteracted(true);
          setQuery(next);
          onChange(next);
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
        className="customInput w-full"
        autoComplete="off"
      />

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-72 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-textColorSecond">
              Searching...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-textColorSecond">
              No addresses found
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
                  <div className="shrink-0 text-xs uppercase tracking-[0.12em] text-textColorSecond">
                    {item.featureType === "poi" ? "Business" : "Address"}
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
