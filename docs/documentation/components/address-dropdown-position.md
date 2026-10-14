# `app/_components/Dahsboard/booking/create/addressDropdownPosition.ts`

## Purpose
Placement for `AddressAutocompleteInput`'s `floating` suggestion list, fixed to the viewport. Tested in
`addressDropdownPosition.test.ts`.

## Functions
### `addressDropdownPosition(rect, viewportHeight)`
`{ left, width, top | bottom, maxHeight }`: 4px under the input at its width, height shrunk to the room left
(8px edge margin, never past 288px / max-h-72); above the input instead when less than 160px fits below and more
fits above.
