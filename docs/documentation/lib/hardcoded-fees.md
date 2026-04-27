# Hardcoded Fees

## Source

- `lib/booking/pricing/hardcodedFees.ts`

## Responsibility

Defines order-level hardcoded fee codes, labels, and extra-work block pricing shared by the booking calculator and WordPress importer.

## Functions

| Function | Description |
| --- | --- |
| `calculateExtraWorkFee` | Converts total extra-work minutes into started 20-minute blocks at 150 NOK per block. |
