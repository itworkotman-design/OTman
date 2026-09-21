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
    <div className="flex flex-wrap justify-center gap-3">
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
              "flex w-40 flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-center transition disabled:opacity-50",
              selected
                ? "border-logoblue bg-logoblue/5"
                : "border-black/10 hover:-translate-y-0.5 hover:border-logoblue/40 hover:shadow-md",
            ].join(" ")}
          >
            <span
              className={[
                "grid h-14 w-14 place-items-center rounded-full",
                selected ? "bg-logoblue text-white" : "bg-logoblue/10 text-logoblue",
              ].join(" ")}
            >
              <ProductIcon code={list.iconCode} className="h-8 w-8" />
            </span>
            <span className={["text-sm font-semibold", selected ? "text-logoblue" : "text-black/80"].join(" ")}>
              {loadingCode === list.code ? (locale === "no" ? "Laster…" : "Loading…") : label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
