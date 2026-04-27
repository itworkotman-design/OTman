# Search Normalization

## Source

- `lib/searchNormalization.ts`

## Responsibility

Normalizes free-text search values so matching can ignore letter case and whitespace across names, emails, ids, and phone-like numbers.

## Functions

| Function | Description |
| --- | --- |
| `normalizeSearchText` | Converts a value to lowercase text, trims it, and removes whitespace. |
| `normalizedIncludes` | Checks whether a normalized field value contains a normalized query. |
