import { Fragment } from "react";
import { PinIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { ReviewBlock } from "./orderReview";

// The review page's building blocks, shared by every website booking flow's
// final step (delivery/white goods, moving) and the admin WebsiteOrderModal,
// so they all look the same.

// The answers as labelled cards: one per block, a location pin on
// pickup/delivery/move-end blocks. Notes keep their line breaks.
export function OrderReviewBlocks({ blocks }: { blocks: ReviewBlock[] }) {
  return (
    <>
      {blocks.map((block) => (
        <div key={block.title} className="rounded-2xl border border-black/10 bg-white p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-logoblue">
            {block.kind === "location" && <PinIcon />}
            {block.title}
          </h3>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {block.rows.map((row) => (
              <Fragment key={row.label}>
                <dt className="text-black/50">{row.label}</dt>
                <dd className="wrap-break-word whitespace-pre-line text-black/85">{row.value}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      ))}
    </>
  );
}

// WhiteGoodsOrderSummary's `totalFooter` on a review page: subtotal ex. VAT,
// VAT, and the highlighted total incl. VAT the customer pays. The subtotal is
// emphasised for a business customer (whose prices are shown ex. VAT).
export function ReviewTotalFooter({
  locale,
  exVat,
  vat,
  incVat,
  emphasiseExVat,
}: {
  locale: Locale;
  exVat: number;
  vat: number;
  incVat: number;
  emphasiseExVat: boolean;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  return (
    <div className="flex flex-col gap-2 text-sm text-black/70">
      <div className={`flex justify-between ${emphasiseExVat ? "font-semibold text-black/85" : ""}`}>
        <span>{t("Subtotal (ex. VAT)", "Delsum (eks. mva)")}</span>
        <span className="tabular-nums">{exVat.toLocaleString("nb-NO")} kr</span>
      </div>
      <div className="flex justify-between">
        <span>{t("VAT (25%)", "MVA (25%)")}</span>
        <span className="tabular-nums">{vat.toLocaleString("nb-NO")} kr</span>
      </div>
      {/* What the customer actually pays — highlighted so it can't be missed. */}
      <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-logoblue/10 px-4 py-5">
        <span className="text-base font-semibold text-logoblue">{t("Total incl. VAT", "Totalt inkl. MVA")}</span>
        <span className="whitespace-nowrap text-3xl font-bold tabular-nums text-logoblue">
          {incVat.toLocaleString("nb-NO")} kr
        </span>
      </div>
    </div>
  );
}
