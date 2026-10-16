// Small "?" badge that reveals extra context in a bubble on hover (or focus,
// for keyboard/touch) — used for a tile's size spec (WhiteGoodsProductGrid),
// a product card's section hints and the order summary's price note, so the
// hint text doesn't take up space unless the customer wants it.
// `placement="below"` opens the bubble downward from the badge's left edge,
// for spots where a bubble above would be clipped (the product card's
// options sit in an overflow-hidden wrapper).
export function InfoHint({ label, placement = "above" }: { label: string; placement?: "above" | "below" }) {
  return (
    <span
      tabIndex={0}
      aria-label={label}
      className="group/hint relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-black/20 text-[9px] font-semibold leading-none text-black/50 outline-none focus-visible:border-logoblue focus-visible:text-logoblue"
    >
      ?
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute z-10 w-max max-w-56 rounded-lg bg-black/85 px-2 py-1 text-[11px] font-normal leading-snug text-white opacity-0 transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-visible/hint:opacity-100",
          placement === "above" ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2 text-center" : "top-full left-0 mt-1.5 text-left",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}
