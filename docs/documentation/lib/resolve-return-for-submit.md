# Resolve Return For Submit

## Source

- `lib/orders/resolveReturnForSubmit.ts`

## Responsibility

Builds the return-address fields the order form submits. A hidden return section (no return option selected) or a blank address never carries the saved return location or coordinates kept in form state, so the order APIs can't re-fill a return address from a stale saved-location id and GSM doesn't get a return task for an order that has none.

## Functions

| Function | Description |
| --- | --- |
| `resolveReturnForSubmit` | Returns `returnAddress`, `customReturnAddressId`, `returnLatitude` and `returnLongitude` for submit — blanked when the section is hidden, saved location/coordinates dropped when the address is blank. |
