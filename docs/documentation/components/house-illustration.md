# `app/_components/site/BookingModal/moving/HouseIllustration.tsx`

## Purpose
Decorative SVG house shown to the right of the moving flow's size tiles
(`MovingRequestFlow.tsx`). Wider for a bigger size bracket, one stacked floor
per story, drawn as a 3D (oblique) box — shaded side wall with its own
windows, two-plane gable roof with chimney, ground shadow. New floors
fade/drop in and the roof slides up onto the top
floor (disabled under `prefers-reduced-motion`). No dependencies.

## Functions
### `HouseIllustration({ sizeCode, floors, className })`
Renders from `houseGeometry()` (`houseGeometry.ts`). Ground floor gets a door.
