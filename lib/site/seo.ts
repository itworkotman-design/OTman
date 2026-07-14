const locales = ["no", "en"] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = "no";

/** Canonical + hreflang alternates for a page at `path` (e.g. "/kontakt"), keyed to the current locale. */
export function buildAlternates(locale: Locale, path: string = "") {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])),
      // proxy.ts falls back to the "no" version for any unmatched locale, so that's the correct x-default target.
      "x-default": `/${defaultLocale}${path}`,
    },
  };
}
