# app/_components/utils/CopyButton.tsx

Small icon button that copies a value to the clipboard.

- Props: `value` (string/number; renders nothing when empty or `"-"`, via `lib/clipboard/copyText.ts`), `ariaLabel` (also the tooltip), optional `dataAttribute` (marker attribute so parent row-click handlers can ignore it), `className`.
- Stops click propagation; shows a checkmark for 1.5 s after a successful copy.
- Used in `BookingArchiveTable` (order id/number, phone, pickup/delivery address cells) and next to the field labels in the create/edit order form (`OrderFieldsForm`: order number, delivery/return address, both customer phones; `PickupLocations`: main and extra pickup addresses).
