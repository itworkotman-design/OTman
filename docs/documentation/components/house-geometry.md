# `app/_components/site/BookingModal/moving/houseGeometry.ts`

## Purpose
Pure geometry for `HouseIllustration.tsx`, kept separate so it's unit tested
(`houseGeometry.test.ts`). Fixed viewBox, so the house grows upward from the
ground line. `depth` ({dx, dy}) is the 3D offset of the side wall/roof; roof
rise scales with width (`ROOF_PITCH`) so wide houses keep a pitch.

## Functions
### `clampFloors(n)`
Rounds and clamps to `HOUSE_MIN_FLOORS`..`HOUSE_MAX_FLOORS` (1..`MOVING_MAX_FLOORS`); non-numbers → 1.
### `houseGeometry(sizeCode, floorCount)`
Width + windows per floor from the size bracket code (`lib/content/movingCatalog.ts`;
unknown/null → the `SIZE_UNDER_60` shape), floor rects (index 0 = ground), roof position.
