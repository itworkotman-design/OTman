# Short catalog codes

## Source

- `lib/content/shortCatalogCode.ts`

## Responsibility

One rule for the option codes of every website catalog (white goods, furniture, parcel/pallet). The main words stay: ASM, DISMANTLE, RETURN, UNPACKING, product names and brands. Describing words are abbreviated from one dictionary, for example `DISMANTLE_CAREFUL_LARGE_7_DRAWERS` → `DISMANTLE_CAR_LG_7_DRW` and `ASM_STANDARD_WARDROBE_HINGED_DOORS_OTHER_MANUFACTURER` → `ASM_STD_WARDROBE_HNG_DR_OTHER`. The longest code went from 55 to 35 characters.

Product codes (`WG_…`, `FN_…`, `PKG_…`) are not shortened: they are the product names, and icons are derived from them.

## Functions

- `shortenCatalogCode(code)` — applies the dictionary to whole `_`-separated words, longest phrase first. Applying it twice changes nothing, so it also maps an old long code to its new one. Used for these:
  - the seeder renames old options in place;
  - `groupDismantlingOptions`, `groupAssemblyOptions`, `categorizeWhiteGoodsLineCode` and `findWebsiteOptionSeed` match old and new codes alike. Past orders' stored lines keep their old codes.

## Adding to the dictionary

An abbreviation must never itself be a key (`shortCatalogCode.test.ts` checks that every seeded code is unchanged by a second pass). Codes must stay unique within each product (also tested).
