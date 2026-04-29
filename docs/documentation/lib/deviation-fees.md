# Deviation Fees

## Source

- `lib/booking/pricing/deviationFees.ts`

## Responsibility

Defines the deviation options, default customer and subcontractor prices, canonical English labels, and Norwegian WordPress aliases used by the booking calculator, price-list settings, and importer.

## Functions

| Function | Description |
| --- | --- |
| `getDeviationFeeOption` | Matches a deviation by code, English label, Norwegian label, or legacy WordPress `price:label:code` value and returns its canonical fee option. |
| `normalizeDeviationLabel` | Converts a matched English, Norwegian, or WordPress deviation value into the canonical English label stored on orders. |
