const locales = ["no", "en"] as const;
type Locale = (typeof locales)[number];

/** Canonical + hreflang alternates for a page at `path` (e.g. "/kontakt"), keyed to the current locale. */
export function buildAlternates(locale: Locale, path: string = "") {
  return {
    canonical: `/${locale}${path}`,
    languages: Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])),
  };
}
