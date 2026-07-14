"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicBlogTag } from "@/lib/blog/publicBlogQueries";

type Props = {
  name: string;
  label: string;
  placeholderLabel: string;
  availableTags: PublicBlogTag[];
  initialSelected: string[];
};

export default function TagFilterDropdown({ name, label, placeholderLabel, availableTags, initialSelected }: Props) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleTag(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  const buttonLabel = selected.length > 0 ? `${label} (${selected.length})` : placeholderLabel;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2 text-sm font-semibold text-textcolor">
      {label}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="customInput flex items-center justify-between font-normal"
      >
        <span>{buttonLabel}</span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {selected.map((slug) => (
        <input key={slug} type="hidden" name={name} value={slug} />
      ))}

      {open ? (
        <div className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-linePrimary bg-white p-2 shadow-lg">
          {availableTags.map((tag) => {
            const isSelected = selected.includes(tag.slug);
            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => toggleTag(tag.slug)}
                className={`mb-1 flex w-full items-center rounded-md px-2 py-1 text-left text-sm font-normal last:mb-0 ${
                  isSelected ? "bg-logoblue text-white" : "text-textcolor hover:bg-linePrimary/20"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
