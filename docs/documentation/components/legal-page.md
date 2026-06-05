# Legal Page

## Source

- `app/_components/site/pageComponents/LegalPage.tsx`
- `app/(site)/[locale]/privacy-policy/page.tsx`
- `app/(site)/[locale]/terms/page.tsx`

## Responsibility

Renders the shared localized legal page layout for the public privacy policy and terms and conditions routes.

## Functions

| Function | Description |
| --- | --- |
| `LegalPage` | Renders the legal title, last-updated date, intro paragraphs, sections, paragraphs, and optional bullet lists. |
| `Page` | Resolves the active locale and renders `LegalPage` with either privacy policy or terms content. |
