# Known Drivers

## Source

- `lib/orders/knownDrivers.ts`

## Responsibility

Defines the deploy-time canonical driver registry used by the booking archive. Each entry has a stable filter id, display name, and an alias list that can be extended when recurring legacy spellings are found.

## Exports

| Export | Description |
| --- | --- |
| `KnownDriver` | Describes one canonical driver and its aliases. |
| `KNOWN_DRIVERS` | Lists Gints, Matiss, Otto, Ronalds, Altin, Arno, Edijs, Gabriel, Learning team, Maris, and Norsen. |
