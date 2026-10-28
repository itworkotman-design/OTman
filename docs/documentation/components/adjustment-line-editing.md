# Adjustment Line Editing

## Source

- `app/_components/Dahsboard/booking/create/adjustmentLineEditing.ts`

## Responsibility

Calculator UI state for adjustment lines: which lines are open as drafts (inputs + Apply) versus shown as applied rows.

## Functions

| Function | Description |
| --- | --- |
| `trackNewAdjustmentLines` | Registers lines seen for the first time and opens only freshly added empty lines as drafts; lines loaded from a saved order and linked partner minus lines stay as applied rows. Returns `null` when nothing changed. |
| `sanitizeAmountInput` | Filters the amount field as you type or paste: digits plus one decimal separator (`,` or `.`, kept as typed) with at most 2 decimals; letters, spaces and minus signs are dropped. |
