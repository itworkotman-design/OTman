# `app/_components/site/BookingModal/moving/HouseIllustration.tsx`

## Purpose
Decorative 3D (oblique) SVG building shown to the right of the moving flow's
size tiles (`MovingRequestFlow.tsx`). Wider for a bigger size bracket, one
stacked floor per story, styled by the property type picked on the flow's
home-type step:
- Enebolig (`DETACHED`, also the default before a type is picked): gable-roof house, chimney, door on the left.
- Rekkehus (`TOWNHOUSE`): the same unit with washed-out neighbouring units attached on both sides
  (an `feColorMatrix` filter, not opacity, so the right neighbour solidly hides this unit's side wall).
- Leilighet (`APARTMENT`): flat-roof block with parapet, balconies on upper floors, central entrance with canopy, stair/lift housing on the roof.
- Kontor (`OFFICE`): flat-roof block with glass window bands (also on the side wall), glass double doors, a ventilation unit on the roof.

New floors fade/drop in and the roof slides up onto the top floor (disabled
under `prefers-reduced-motion`). No dependencies.

## Functions
### `HouseIllustration({ sizeCode, floors, homeType, className })`
Renders from `houseGeometry()` (`houseGeometry.ts`) via internal `Building`
(floor stack + roof), `Facade`/`SideWindow` (per-type windows/doors) and
`GableRoof`/`FlatRoof`.
