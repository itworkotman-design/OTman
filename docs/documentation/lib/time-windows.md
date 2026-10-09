# Time Windows

## Source

- `lib/booking/timeWindows.ts`

## Responsibility

The two preset delivery windows (`10:00-16:00`, `16:00-21:00`) plus a "specific time" custom range. Shared by the dashboard order editor and the public booking flows.

## Functions

| Function | Purpose |
|---|---|
| `parseTimeWindowValue` | Stored string → selector state (preset, custom from/to, or legacy text). |
| `buildTimeWindowValue` | Selector state → stored string. |
| `isTimeWindowComplete` | Whether a value is usable: a preset, or a custom range of real `HH:MM` times that ends after it starts. The server holds new homepage orders and "My order" schedule changes to it. |
