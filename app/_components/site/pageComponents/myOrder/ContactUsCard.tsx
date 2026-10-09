import Link from "next/link";
import { ArrowRightIcon, ChatIcon } from "./myOrderIcons";

// "Questions about an order?" box on the My order pages. `stacked` = one
// column, for the order page's narrow side column.
export default function ContactUsCard({ locale, stacked = false }: { locale: "no" | "en"; stacked?: boolean }) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  return (
    <section className={`flex flex-col gap-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 sm:p-6 ${stacked ? "" : "sm:flex-row sm:items-center"}`}>
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-logoblue">
        <ChatIcon className="h-8 w-8" />
      </span>
      <div className="flex-1">
        <h2 className="text-lg font-bold text-gray-900">{t("Questions about an order?", "Har du spørsmål om en bestilling?")}</h2>
        <p className="mt-1 text-textColorThird">
          {t("Call us on 40 28 49 77 or send us a message.", "Kontakt oss på telefon 40 28 49 77 eller send oss en melding.")}
        </p>
      </div>
      <Link
        href={`/${locale}/kontakt`}
        className="inline-flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-logoblue transition hover:border-logoblue"
      >
        {t("Contact us", "Kontakt oss")}
        <ArrowRightIcon className="h-5 w-5" />
      </Link>
    </section>
  );
}
