# Driver Normalization

## Source

- `lib/orders/driverNormalization.ts`

## Responsibility

Provides the shared driver-name normalization used by archive options, filtering, table display, and exports. It resolves names against `lib/orders/knownDrivers.ts`, accepts a unique one-character spelling error, and preserves unmatched names. Blank, zero, and dash-only values are treated as no driver. Comma, slash, semicolon, plus, ampersand, line-break, `and`, and `og` separators are supported, so values such as `-otto, edijs` and `-otto/ edijs` display as `Otto, Edijs` and match either driver's filter.

## Functions

| Function | Description |
| --- | --- |
| `cleanDriverName` | Trims a driver value and collapses repeated whitespace. |
| `isNoDriverValue` | Identifies blank, zero, and dash-only no-driver values. |
| `normalizeDriverKey` | Builds a lowercase alphanumeric key for driver comparisons. |
| `hasAtMostOneEdit` | Checks whether two normalized keys differ by no more than one edit. |
| `areDriverNamesEquivalent` | Matches exact normalized names and eligible one-edit spelling variants. |
| `formatUnknownDriverName` | Produces consistent casing for unmatched single-case names while preserving mixed-case values. |
| `splitDriverValue` | Splits a stored value into one or more driver-name parts and removes a leading dash marker. |
| `getExactKnownDriver` | Resolves a configured id, canonical name, or alias without fuzzy matching. |
| `getKnownDriver` | Resolves an exact match or a unique one-character spelling variation. |
| `resolveDriverParts` | Converts a stored single- or multi-driver value into deduplicated canonical and unmatched parts. |
| `getKnownDriverFilterOptions` | Returns the canonical TypeScript registry as filter options. |
| `matchesDriverFilter` | Matches an order when any resolved driver equals the selected canonical driver, or applies the no-driver sentinel. |
| `getDriverDisplayLabel` | Joins resolved drivers into one canonical display label or returns the supplied no-driver label. |
