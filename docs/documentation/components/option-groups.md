# `app/_components/site/BookingModal/whiteGoods/optionGroups.ts`

## Purpose
Grouping helpers for the website product card: furniture assembly is a type + manufacturer choice, TV installation a type (wall mount / TV bench or table / stand) + size choice, and dismantling comes in two variants per type, both stored as flat options.

## Functions
- `buildOptionSeedMap(productCode)` — option seeds by code. Lookups use `shortenCatalogCode(option.code)`, and dismantling pairs match `DISMANTLE_(DISP|CAR)_…` on the shortened code, so old long codes in a not-yet-reseeded database work too.
- `groupAssemblyOptions(options, seedByCode, locale)` — types with their manufacturer (furniture) or size (TV) options, `choiceKind` saying which, and a "from" price. Uses the seed's `typeEn` + `manufacturer` or `size`; empty for other white goods and Other furniture.
- `groupDismantlingOptions(options, locale)` — per type: the for-disposal and careful-for-reuse options.
- `pickDefaultInstallOptionId({ assemblyGroups, typeOptions })` — the installation option "Installation only" starts with: the first grouped type + its first choice, else white goods' first install type; `null` if none.
