# Website Price List Menu

## Source

- `app/_components/Dahsboard/booking/WebsitePriceListMenu.tsx`

## Responsibility

The "Website" pill on the edit-prices page: a tab-style button (globe icon, the active website list's name or "Website", chevron) that opens a custom menu of the website price lists. Custom instead of a native `<select>` so the pill is only as wide as its own label. Closes on outside click and Escape.

## Functions

| Function | Description |
| --- | --- |
| `WebsitePriceListMenu` | Renders the pill and its menu; calls `onSelect(id)` when a list is chosen. |
