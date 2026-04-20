# Pickup Locations

## Source

- `app/_components/Dahsboard/booking/create/PickupLocations.tsx`

## Responsibility

Renders the main pickup address and the editable list of additional pickup rows, including the one-of-two phone/email validation state for each extra pickup.

## Functions

| Function | Description |
| --- | --- |
| `PickupLocations` | Renders the pickup address section, prevents extra pickups when the main pickup is unavailable, defaults new extra-pickup phones to `+47`, shows `*` on both phone and email until one valid contact method is present, renders inline red error boxes for pickup and contact validation, and assigns stable input ids so submit can jump to the first failing pickup field. |
