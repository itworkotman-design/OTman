# Pickup Locations

## Source

- `app/_components/Dahsboard/booking/create/PickupLocations.tsx`

## Responsibility

Renders the main pickup address and the editable list of additional pickup rows. Extra pickup phone and email fields are optional, but still show field-level errors when a provided value is malformed.

## Functions

| Function | Description |
| --- | --- |
| `PickupLocations` | Renders the pickup address section, prevents extra pickups when the main pickup is unavailable, renders optional phone and email inputs for each extra pickup, shows inline red error boxes for invalid provided contact values, and assigns stable input ids so submit can jump to the first failing pickup field. |
