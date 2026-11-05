"use client";

import type { Locale } from "@/lib/content/ServiceWindowContent";
import { ProductIcon } from "./productIcons";
import type { WebsiteListInfo } from "./websiteLists";

// The category picker used by both "What are we picking up?" (all lists, the
// chosen one highlighted) and "Any other products you need added?" (only the
// lists not on the order yet): one tile per website price list, with its
// general icon.
export function WebsiteListTiles({
  locale,
  lists,
  selectedCode,
  loadingCode,
  onPick,
}: {
  locale: Locale;
  lists: WebsiteListInfo[];
  selectedCode: string | null;
  loadingCode: string | null;
  onPick: (code: string) => void;
}) {
  return (
    // Phone: 3 per row at a third of the width each, and a shorter row (e.g. the
    // 2 lists left in "any other products?") stays centered. From sm up,
    // fixed-width tiles wrap centered.
    <div className="flex w-full flex-wrap justify-center gap-2 sm:gap-3">
      {lists.map((list) => {
        const selected = selectedCode === list.code;
        const label = locale === "no" ? list.labelNo : list.labelEn;
        return (
          <button
            key={list.code}
            type="button"
            disabled={loadingCode !== null}
            aria-pressed={selected}
            onClick={() => onPick(list.code)}
            className={[
              "flex min-w-0 basis-[calc((100%-1rem)/3)] flex-col items-center gap-2 rounded-2xl border px-1 py-3 text-center transition disabled:opacity-50 sm:w-40 sm:basis-auto sm:px-4 sm:py-4",
              selected
                ? "border-logoblue bg-logoblue/5"
                : "border-black/10 hover:-translate-y-0.5 hover:border-logoblue/40 hover:shadow-md",
            ].join(" ")}
          >
            <span
              className={[
                "grid h-11 w-11 place-items-center rounded-full sm:h-14 sm:w-14",
                selected ? "bg-logoblue text-white" : "bg-logoblue/10 text-logoblue",
              ].join(" ")}
            >
              <ProductIcon code={list.iconCode} className="h-6 w-6 sm:h-8 sm:w-8" />
            </span>
            <span className={["wrap-break-word text-xs font-semibold sm:text-sm", selected ? "text-logoblue" : "text-black/80"].join(" ")}>
              {loadingCode === list.code ? (locale === "no" ? "Laster…" : "Loading…") : label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
