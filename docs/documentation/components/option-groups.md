# `app/_components/site/BookingModal/whiteGoods/optionGroups.ts`

## Purpose
Grouping helpers for the website product card: furniture assembly is a type + manufacturer choice and dismantling comes in two variants per type, both stored as flat options.

## Functions
- `buildOptionSeedMap(productCode)` — option seeds by code. Lookups use `shortenCatalogCode(option.code)`, and dismantling pairs match `DISMANTLE_(DISP|CAR)_…` on the shortened code, so old long codes in a not-yet-reseeded database work too.
- `groupAssemblyOptions(options, seedByCode, locale)` — types with their manufacturer options and a "from" price; empty for white goods and Other furniture.
- `groupDismantlingOptions(options, locale)` — per type: the for-disposal and careful-for-reuse options.
- `pickDefaultInstallOptionId({ assemblyGroups, typeOptions })` — the installation option "Installation only" starts with: furniture's first assembly type + first manufacturer, else white goods' first install type; `null` if none.
