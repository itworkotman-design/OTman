# Invoice PDF

## Source

- `lib/invoices/invoicePdf.ts`

## Responsibility

The faktura file emailed to a homepage customer (manual payments). Every faktura is two pages:

1. **The faktura** — seller (name, address, org no., email), the customer (name, address, org no. for a business), number, dates, bank account and "Merk betalingen", then **one line**: "Betaling for ordre 1042" and the sum, with sum ex. VAT, VAT 25 % and the highlighted amount to pay.
2. **The calculator page (Vedlegg)** — what that faktura covers: the whole calculator on the first faktura, only the added/changed lines on a follow-up.

Each new faktura's file holds every faktura so far, oldest first. An earlier faktura already marked paid is stamped with a large diagonal **"BETALT"** on both its pages; the newest one (what's owed now) never is. An earlier unpaid faktura is left unstamped, since it's still owed. A kreditnota is a single "Kreditnota" page with the amount owed back ("Til gode").

Uses `pdf-lib` with the standard Helvetica fonts (WinAnsi): characters outside Latin-1 and the usual typographic marks are replaced rather than failing the file.

## Functions

| Function | Description |
| --- | --- |
| `buildInvoicePages(input)` | The pure layout (tested): pages in order with their number, title, lines, totals, calculator rows and watermark flag. Snapshot group keys `extras`/`adjustment` are shown as "Tillegg"/"Justering". |
| `renderInvoicePdf(input)` | Draws those pages to PDF bytes (A4). A long calculator page continues onto further pages, stamped too when it's paid. |
