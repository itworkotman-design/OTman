"use client";

import { useEffect, useRef, useState } from "react";

type PriceListOption = { id: string; name: string };

type Props = {
  priceLists: PriceListOption[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

// The edit-prices page's "Website" pill: one tab-style button (globe icon +
// the active website list's name, or just "Website") that opens a menu of the
// website price lists. Custom rather than a <select> so the pill is only as
// wide as its own label, not as its longest option.
export default function WebsitePriceListMenu({ priceLists, activeId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const active = priceLists.find((item) => item.id === activeId) ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Website pricelists"
        className={`customButtonDefault inline-flex items-center gap-2 ${
          active
            ? "bg-logoblue text-white! hover:text-logoblue!"
            : "bg-white text-logoblue"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <span>{active ? active.name : "Website"}</span>
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={open ? "rotate-180" : ""}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 w-max min-w-full overflow-hidden rounded-xl border border-linePrimary bg-white py-1 shadow-lg"
        >
          {priceLists.map((item) => {
            const selected = item.id === activeId;

            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                className={`block w-full whitespace-nowrap px-4 py-1.5 text-left text-sm ${
                  selected
                    ? "bg-logoblue text-white"
                    : "text-textcolor hover:bg-linePrimary/20"
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
