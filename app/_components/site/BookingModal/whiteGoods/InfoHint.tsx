"use client";

import { useEffect, useRef, useState } from "react";

// Small "?" badge that reveals extra context in a bubble on hover (or focus,
// for keyboard/touch) — used for a tile's size spec (WhiteGoodsProductGrid),
// a product card's section hints and the order summary's price note, so the
// hint text doesn't take up space unless the customer wants it.
// `placement` keeps the bubble inside a clipping (overflow-hidden) parent like
// the product card: "above" centres it over the badge; "above-start" opens it
// upward from the badge's left edge (a badge near the parent's left side);
// "below" opens it downward from the left edge (a badge at the parent's top).
// The same bubble without a badge, for a whole element that explains itself
// on hover (the product card's option rows): put it inside an element with
// `relative group/tip`, and it shows while that element is hovered or
// keyboard-focused. Opens upward from the element's left edge, like
// InfoHint's "above-start", so it stays inside the product card.
export function HoverTip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-4 z-10 mb-1 w-max max-w-56 rounded-lg bg-black/85 px-2 py-1 text-left text-[11px] font-normal leading-snug text-white opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100"
    >
      {label}
    </span>
  );
}

// Phones have no hover: a tap on the badge toggles the bubble, and a tap
// anywhere else closes it. Hover only opens it on devices that can really
// hover — a phone's "sticky hover" after a tap would otherwise keep it open.
export function InfoHint({ label, placement = "above" }: { label: string; placement?: "above" | "above-start" | "below" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-expanded={open}
      onClick={(e) => {
        // Don't also trigger a surrounding clickable (a tile or option row).
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      className={[
        "group/hint relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border text-[9px] font-semibold leading-none outline-none focus-visible:border-logoblue focus-visible:text-logoblue",
        // A slightly larger invisible tap target for fingers.
        "before:absolute before:-inset-2 before:content-['']",
        open ? "border-logoblue text-logoblue" : "border-black/20 text-black/50",
      ].join(" ")}
    >
      ?
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute z-10 w-max max-w-56 rounded-lg bg-black/85 px-2 py-1 text-[11px] font-normal leading-snug text-white transition-opacity duration-150 [@media(hover:hover)]:group-hover/hint:opacity-100 group-focus-visible/hint:opacity-100",
          open ? "opacity-100" : "opacity-0",
          placement === "above"
            ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2 text-center"
            : placement === "above-start"
              ? "bottom-full left-0 mb-1.5 text-left"
              : "top-full left-0 mt-1.5 text-left",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}
