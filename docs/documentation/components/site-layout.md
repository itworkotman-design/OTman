# Site Layout

## Source

- `app/(site)/[locale]/layout.tsx`

## Responsibility

Validates the public site locale, wraps localized public pages with the site navbar and footer, provides default SEO metadata, and emits LocalBusiness JSON-LD for the public website.

## Functions

| Function | Description |
| --- | --- |
| `metadata` | Defines default title, description, keywords, canonical links, Open Graph, Twitter, and robots metadata for the public site. |
| `localBusinessJsonLd` | Defines structured LocalBusiness data for search engines. |
| `SiteLayout` | Resolves the locale route parameter, returns 404 for unsupported locales, and renders the shared public site shell. |
