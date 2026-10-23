# `app/_components/site/BookingModal/whiteGoods/optionGroups.ts`

## Purpose
Grouping helpers for the website product card: furniture assembly is a type + manufacturer choice, TV installation a type (wall mount / TV bench or table / stand) + size choice, and dismantling comes in two variants (for disposal / for reuse), both stored as flat options.

## Functions
- `buildOptionSeedMap(productCode)` — option seeds by code. Lookups use `shortenCatalogCode(option.code)`, and dismantling pairs match `DISMANTLE_(DISP|CAR)_…` on the shortened code, so old long codes in a not-yet-reseeded database work too.
- `groupAssemblyOptions(options, seedByCode, locale)` — types with their manufacturer (furniture) or size (TV) options, `choiceKind` saying which, and a "from" price. Uses the seed's `typeEn` + `manufacturer` or `size`; empty for other white goods and Other furniture.
- `groupDismantlingOptions(options, locale)` — pairs the for-disposal and careful-for-reuse options (one pair in today's catalog; older data had one per type).
- `toggleDismantlingSelection(selectedIds, groups, optionId)` — one dismantling choice per item: picking one replaces any other, picking it again clears it; other extras are kept.
- `toggleDismantlingEnabled(selectedIds, groups)` — the card's "Dismantling" checkbox: ticking it selects for disposal, unticking clears either variant. Once ticked, the card lists "For disposal" / "For reuse" as nested radio rows, like unpacking + pallet pickup.
- `pickDefaultInstallOptionId({ assemblyGroups, typeOptions })` — the installation option "Installation only" starts with: the first grouped type + its first choice, else white goods' first install type; `null` if none.
