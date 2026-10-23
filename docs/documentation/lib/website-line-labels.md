# Website Line Labels

## Source

- `lib/content/websiteLineLabels.ts`

## Responsibility

Translates English text stored on homepage orders for the Norwegian site.

- **Delivery-type and order-extra labels** are seeded in English (e.g. "Delivery with carry-in", "Floor surcharge per chargeable floor, no lift").
- **Product names** are stored by their English catalog name (`productsSummary`, calculator snapshots).

Only known seeded text is translated. A label staff have edited is shown as-is, and English is otherwise never changed.

**Renamed seeded labels** (`RENAMED_SEEDED_LABEL`): products and orders saved before a rename still store the old label, which is shown under its new name in both languages. "Delivery to doorstep" → "Delivery to first obstacle" / "Levering til første hindring".

## Functions

| Function | Purpose |
|---|---|
| `localizeWebsiteLineLabel` | A seeded delivery/extra label, or a catalog option stored by its English label, in Norwegian. |
| `localizeWebsiteProductName` | "Washing machine x2" → "Vaskemaskin x2". It keeps any suffix (count, "#2", item name). |
| `localizeProductsSummary` | A whole stored `productsSummary`, item by item. Commas inside an item name's parentheses don't split it. |

Used by the booking modal's order summary, the "My order" pages, and `orderChangeText` (the change lines in customer emails and "My order").

- `localizeWebsiteLineLabelList(list, locale)` — a stored comma list of line labels (`deliveryTypeSummary`, `servicesSummary`) label by label, keeping an `xN` count. Used by the order-received email's details table.
