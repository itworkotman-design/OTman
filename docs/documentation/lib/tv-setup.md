# `lib/booking/tvSetup.ts`

## Purpose
"TV setup" (`TV_SETUP`, category `extra`, 800 kr ex. VAT = 1000 kr incl. VAT) is an additional service on the website TV (`WG_TV`). It is shown in the product card's "Additional services" step whenever a delivery type is picked, with or without mounting. Next to a mount, the shared pricing drops extras, so it is priced by `websiteAssemblyExtras.ts` (`isAssemblyCompatibleExtraCode`), the same way as furniture dismantling. The technician can only set the TV up if the customer has the passwords and cables ready. So ticking it opens `TvSetupChecklist` with:
- a warning: if anything is missing, the setup is stopped, a wasted-trip fee (bomtur) is charged, and a new visit must be booked and paid for;
- a TV provider pick (Altibox / Go3 / Tet / Other). "Other" asks for the provider's name;
- a checklist: Wi-Fi password, TV provider login, the TV's own account password (e.g. Samsung), and power, HDMI, Ethernet and antenna cables and remotes. Every item must be ticked.

The answers are stored on the card as `tvSetup` (`{ provider, providerName, confirmedItems }`), as proof of what the customer confirmed. Only the provider is ever asked for; passwords are never collected.

## Exports
- `TV_SETUP_PROVIDERS`, `TV_SETUP_CHECKLIST` — the provider choices and the checklist items (key + English/Norwegian text).
- `isTvSetupOptionCode(code)` — true for `TV_SETUP`.
- `cardHasTvSetup(card, products)` — whether the card has an active TV setup option in `selectedExtraOptionIds`.
- `isTvSetupComplete(details)` — a known provider (named, for Other, up to `MAX_ITEM_NAME_LENGTH`) and every checklist item confirmed.
- `findTvSetupCardsIncomplete(cards, products)` — ids of TV setup cards whose checklist isn't done. Used by `isListConfigured`, the booking flow's order-details gate, and `validateWebsiteOrderCards` (`TV_SETUP_CONFIRMATION_REQUIRED`, which also runs the Other provider name through `validateTextField`, stores the name trimmed, and drops `tvSetup` from cards without TV setup).
- `tvSetupProviderName(details)` / `tvSetupLabel(label, optionCode, details)` — "TV setup" → "TV setup — Altibox". `withTvSetupProvider(option, details)` does the same to an option's label (English) and description (Norwegian) for stored order items. Applied on the extras lines: `buildProductBreakdowns` and `buildOrderItemsFromCards` (no mount), and `applyWebsiteAssemblyExtras` / `buildWebsiteAssemblyExtraOrderItems` (next to a mount). So the calculator, archive summary and GSM task all show the provider. `localizeWebsiteLineLabel` translates it to "TV-oppsett — Altibox".

The admin website-order editor does not require the checklist (staff take TV setup by phone).
