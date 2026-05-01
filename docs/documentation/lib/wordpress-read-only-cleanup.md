# WordPress Read Only Cleanup

## Source

- `lib/booking/wordpressReadOnlyCleanup.ts`

## Responsibility

Provides the pure comparison helpers that decide when a saved WordPress read-only product snapshot can be cleared. The helpers compare per-card native customer totals, native subcontractor totals, and native calculated line coverage instead of relying on direct selection-array matches.

## Functions

| Function | Description |
| --- | --- |
| `getWordpressReadOnlyTotalCents` | Sums one saved WordPress read-only snapshot into customer total cents. |
| `getNativeBreakdownTotalsCents` | Calculates native customer and subcontractor cents for one rebuilt product breakdown using the active lookup prices and any inline price overrides. |
| `wordpressReadOnlyRowsMatchNativeLines` | Checks whether saved WordPress row totals are fully covered by the native calculated line totals, allowing a WordPress row to be represented by one or more native lines. |
| `shouldClearWordpressImportReadOnly` | Returns whether the editor should clear a product card's WordPress read-only snapshot. It always compares per-card customer totals first, uses per-card subcontractor totals when the pricing snapshot is missing and the import stored them, and otherwise falls back to native line-coverage matching. |
