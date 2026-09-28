# Service Window

## Source

- `app/_components/site/TransportService/ServiceWindow.tsx`
- `app/_components/site/TransportService/serviceModalRouting.ts`

## Responsibility

Renders the home page service carousel/grid (3 tiles: Delivery, Services, Moving).
Clicking a tile opens a modal — it does not route to a page. Which modal a tile
opens is decided by its own id via `serviceModalKind` (`serviceModalRouting.ts`):

| Tile (id) | Modal |
| --- | --- |
| Delivery (`collection-pickup`) | `WhiteGoodsBookingFlow` — the real data-backed white-goods + furniture (+ parcel/pallet) booking flow |
| Services (`services`) | Placeholder `SteppedModal` (no dedicated flow yet) |
| Moving (`moving`) | `MovingRequestFlow` |

Any unrecognised id also falls back to the placeholder `SteppedModal`.
`buildPlaceholderSections`/`buildPlaceholderFinalStep` in `ServiceWindow.tsx` supply
that fallback's content.

`SpecialGoodsQuoteFlow` (and its API routes) still exist but are no longer reachable
from the homepage — the Special goods tile was removed.

An older single-page modal, `ServiceModal.tsx`, is commented out of this file and no
longer rendered; see `docs/homepage-ordering-roadmap.md` §3a for its status.

## Functions

| Function | Description |
| --- | --- |
| `ServiceWindow` | Renders localized service cards, handles carousel scroll/snap behavior, and opens the modal `serviceModalKind` picks for the clicked tile. |
| `serviceModalKind` | Pure mapping from a tile id to `"white-goods"`, `"moving"` or `"placeholder"`. |
| `buildPlaceholderSections` | Builds the two dummy "Step 1"/"Step 2" sections for the placeholder modal (used by the Services tile). |
| `buildPlaceholderFinalStep` | Builds the placeholder final/summary step; its "Continue to payment" button is not wired to anything. |
