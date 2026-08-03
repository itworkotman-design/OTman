"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { codeToUrlPath } from "./types";

type ArchiveSearchResult =
  | { type: "folder"; id: string; name: string; description: string | null; code: string }
  | { type: "item"; id: string; folderId: string; name: string; description: string | null; code: string };

type ArchiveSearchBarProps = {
  // Folder to search within (its whole subtree, not just direct children),
  // or null to search the entire archive — the same query on the API side,
  // just a different traversal anchor, so the root page and every folder
  // page share this one component.
  scopeFolderId: string | null;
  locale: string;
  placeholder: string;
};

const DEBOUNCE_MS = 250;

// Shared pill-shaped search box used across the archive's browsing pages.
// Unlike the old version, this doesn't filter an already-loaded list in
// place — it queries the folder's whole subtree (or the whole archive, from
// the root page) by code/name/description and shows matches in a dropdown,
// since the parent page's own loaded list is never more than one level deep.
export function ArchiveSearchBar({ scopeFolderId, locale, placeholder }: ArchiveSearchBarProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArchiveSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (scopeFolderId) params.set("scope", scopeFolderId);

        const res = await fetch(`/api/archive/search-tree?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);

        if (requestId !== requestIdRef.current) return;
        setResults(res.ok && data?.ok ? (data.results ?? []) : []);
      } catch {
        if (requestId === requestIdRef.current) setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, scopeFolderId]);

  function handleSelect(result: ArchiveSearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/dashboard/archive/${codeToUrlPath(result.code)}`);
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-current text-textColorThird"
      >
        <circle cx="11" cy="11" r="7" strokeWidth="2" />
        <path d="M21 21l-4.3-4.3" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{
          width: "100%",
          border: "1px solid rgba(0,0,0,.1)",
          boxShadow: "0 0 6px rgba(0,0,0,.06)",
          borderRadius: 999,
          padding: "10px 16px 10px 38px",
          font: "inherit",
          fontSize: 13,
        }}
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-80 overflow-y-auto rounded-2xl border border-lineSecondary bg-white text-left shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-sm text-textColorThird">{locale === "nb" ? "Søker..." : "Searching..."}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-textColorThird">
              {locale === "nb" ? "Ingen treff" : "No matches"}
            </div>
          ) : (
            <ul className="divide-y divide-lineSecondary">
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-linePrimary"
                  >
                    <span className="shrink-0 rounded-full bg-logoblue px-2.5 py-1 text-xs font-semibold text-white">
                      {result.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-textcolor">{result.name}</span>
                      {result.description && (
                        <span className="block truncate text-xs text-textColorThird">{result.description}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-textColorThird">
                      {result.type === "folder"
                        ? locale === "nb"
                          ? "Mappe"
                          : "Folder"
                        : locale === "nb"
                          ? "Element"
                          : "Item"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
