# `app/_components/site/BookingModal/moving/houseGeometry.ts`

## Purpose
Pure geometry for `HouseIllustration.tsx`, kept separate so it's unit tested
(`houseGeometry.test.ts`). Fixed viewBox, so the building grows upward from the
ground line. `depth` ({dx, dy}) is the 3D offset of the side wall/roof.

## Functions
### `clampFloors(n)`
Rounds and clamps to `HOUSE_MIN_FLOORS`..`HOUSE_MAX_FLOORS` (1..`MOVING_MAX_FLOORS`); non-numbers → 1.
### `houseGeometry(sizeCode, floorCount, homeType = null)`
Width + windows per floor from the size bracket code (`lib/content/movingCatalog.ts`;
unknown/null → the `SIZE_UNDER_60` shape), floor rects (index 0 = ground, identical for
every type), `variant` (`house`/`townhouse`/`apartment`/`office` from `MOVING_HOME_TYPES`
codes; null → `house`) and `roof` — `style: "gable"` (rise scales with width,
`ROOF_PITCH`) or `"flat"` (apartment/office, just a parapet). A townhouse is centred
on its front face (its side wall is hidden by the neighbour); everything else on front + side.
