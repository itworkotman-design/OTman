# `app/_components/site/BookingModal/whiteGoods/optionGroups.ts`

## Purpose
Grouping helpers for the website product card: furniture assembly is a type + manufacturer choice and dismantling comes in two variants per type, both stored as flat options.

## Functions
- `buildOptionSeedMap(productCode)` — option seeds by code.
- `groupAssemblyOptions(options, seedByCode, locale)` — types with their manufacturer options and a "from" price; empty for white goods and Other furniture.
- `groupDismantlingOptions(options, locale)` — per type: the for-disposal and careful-for-reuse options.
