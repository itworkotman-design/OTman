"use client";

import React, { useEffect, useRef, useState } from "react";

type AddressSuggestion = {
  id: string;
  label: string;
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
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

useEffect(() => {
  setQuery(value);
  setOpen(false);
  setHasInteracted(false);
}, [value]);

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
          `/api/address-search?q=${encodeURIComponent(trimmed)}`,
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
  }, [query, disabled]);

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
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setHasInteracted(true);
          setQuery(next);
          onChange(next);
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
                onClick={() => {
                  onChange(item.label);
                  setQuery(item.label);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
