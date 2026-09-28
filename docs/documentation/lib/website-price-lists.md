# Website Price Lists

## Source

- `lib/products/websitePriceLists.ts`

## Responsibility

Identifies public-website price lists by name (contains "Website", any case) and groups them apart from the booking price lists on the edit-prices page. `hasEnglishDescriptionColumn` shares the same rule.

## Functions

| Function | Description |
| --- | --- |
| `isWebsitePriceList` | True when a price-list name contains "website" (case-insensitive). |
| `splitWebsitePriceLists` | Splits a list of price lists into `{ regular, website }`, keeping each group's order. |
