# `app/_components/site/BookingModal/services/serviceIcons.tsx`

## Purpose
24x24 line icons (shared `Base` from `iconBase.tsx`) for the services modal's
tiles, one per `ServiceIconKey` (electrician, carpenter, plumber, garden,
cleaning, it, custom). Placeholder drawings in the same style as the product
icons — swap any entry once real artwork exists.

## Functions
### `ServiceIcon({ iconKey, ...svgProps })`
Renders the icon for `iconKey`.

### `AssemblyIcon`, `MovingIcon`
Icons for the services modal's two switch tiles (to the assembly/delivery and
moving modals) — not `ServiceIconKey`s, since they aren't requestable services.
