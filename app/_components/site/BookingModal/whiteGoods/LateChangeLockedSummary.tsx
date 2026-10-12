"use client";

import { Fragment } from "react";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import ContactUsCard from "@/app/_components/site/pageComponents/myOrder/ContactUsCard";
import type { ReviewBlock } from "./orderReview";
import { PinIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";

// "My order" within 24h of the job: the date, addresses and products as
// booked, read-only, with why they can't change and how to reach us.

export function LateChangeLockedSummary({ locale, blocks }: { locale: Locale; blocks: ReviewBlock[] }) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t(
          "It's less than 24 hours until the job, so the date, addresses and products can no longer be changed here. You can still change your contact details and add services below. If something else needs to change, contact us.",
          "Det er mindre enn 24 timer til oppdraget, så dato, adresser og varer kan ikke lenger endres her. Du kan fortsatt endre kontaktinformasjonen din og legge til tjenester nedenfor. Må noe annet endres, ta kontakt med oss.",
        )}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {blocks.map((block) => (
          <div key={block.title} className="rounded-2xl border border-black/10 bg-black/2 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-black/70">
              <PinIcon />
              {block.title}
            </h3>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {block.rows.map((row) => (
                <Fragment key={row.label}>
                  <dt className="text-black/50">{row.label}</dt>
                  <dd className="wrap-break-word text-black/75">{row.value}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <ContactUsCard locale={locale} />
    </div>
  );
}
