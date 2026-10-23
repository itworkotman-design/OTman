# `lib/booking/otherManufacturer.ts`

## Purpose
Furniture assembly is a type + manufacturer pick ("Single bed — IKEA"). When the customer picks "— Other manufacturer" (option codes `ASM_…_OTHER`), the website product card opens a "Which company is it from?" field under that row. The answer is stored in the card's free-text `modelNumber`, so it's saved and shown like any model number ("Bed - Hästens" in the order summary, archive and GSM task). No new card or schema field was needed. Picking another manufacturer, or no assembly, clears it.

## Functions
- `isOtherManufacturerOptionCode(code)` — true for `ASM_…_OTHER`, in short or old long form (`…_OTHER_MANUFACTURER`, via `shortenCatalogCode`).
- `cardHasOtherManufacturer(card, products)` — whether the card has an active other-manufacturer assembly option selected.
- `findOtherManufacturerCardsMissingName(cards, products)` — ids of other-manufacturer cards whose company name is missing, blank or longer than `MAX_ITEM_NAME_LENGTH`. Used everywhere the size-priced item name is required: `isListConfigured` and the booking flow's order-details gate, the dashboard editor's `editorBlockers`, `websiteOrderRepricing` (`ItemNameRequiredError`) and `validateWebsiteOrderCards`. All of them reuse the `ITEM_NAME_REQUIRED` reason.
- `otherManufacturerLabel(label, optionCode, company)` — "Single bed — Other manufacturer" → "Single bed — Hästens" (either language: everything after the last " — " is swapped). Unchanged for any other option, or while no company is typed. Applied in two places:
  - `buildProductBreakdowns` (`fromProductCards.ts`) puts it on the install item as `label`, which the engine uses instead of the option's own label. This covers the customer calculator and the admin website-order editor.
  - `buildOrderItemsFromCards` stores it on the `INSTALL_OPTION` item: `optionLabel` and `rawData.label` get the English form, `rawData.description` the Norwegian form. This covers the archive summary and the GSM task (`orderSummary.ts` reads `rawData.description`). Orders saved before this keep their old line until they're saved again.
- `localizeWebsiteLineLabel` (`lib/content/websiteLineLabels.ts`) translates "Single bed — Hästens" to "Enkeltseng — Hästens" via the seeded "— Other manufacturer" label.
