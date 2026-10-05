# Resolve Driving Distance

## Source

- `lib/orders/resolveDrivingDistance.ts`

## Responsibility

Decides which driving distance a website order is priced with after its details are edited. Both the admin `website-items` route and the customer's "My order" edit use it.

- A typed override always wins.
- Otherwise, if a stop moved, the distance is recalculated through Mapbox.
- If the route can't be worked out (a missing address, or Mapbox failing), the stored distance is kept.

## Functions

| Function | Purpose |
|---|---|
| `resolveDrivingDistance` | Takes the stored order and the edited details, and returns the distance in km as a string. |
