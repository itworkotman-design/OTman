# Service Window

## Source

- `app/_components/site/TransportService/ServiceWindow.tsx`

## Responsibility

Renders the home page service carousel/grid (4 tiles: doorstep delivery, delivery +
assembly, assembly-only, and moving). Clicking a tile opens a modal — it does not
route to a page. The first three tiles (any tile resolving to the `collection-pickup`
service id) all open `WhiteGoodsBookingFlow`, the real data-backed white-goods +
furniture booking flow. The fourth tile ("Flytting"/Moving — resolves to
`MOVING_SERVICE_ID`, `"moving-relocation"`, per `handleItemClick`'s
`items[idx < 3 ? 0 : 1]` indirection) opens `MovingRequestFlow`, a real
quote-request flow (see `docs/documentation/components/moving-request-flow.md`).
`buildPlaceholderSections`/`buildPlaceholderFinalStep` remain in this file as the
fallback for any future tile that isn't wired to a real flow yet, but nothing
currently renders them.

An older single-page modal, `ServiceModal.tsx`, is commented out of this file and no
longer rendered; see `docs/homepage-ordering-roadmap.md` §3a for its status.

## Functions

| Function | Description |
| --- | --- |
| `ServiceWindow` | Renders localized service cards, handles carousel scroll/snap behavior, and opens the appropriate modal (`WhiteGoodsBookingFlow`, `MovingRequestFlow`, or the placeholder `SteppedModal` fallback) per tile. |
| `buildPlaceholderSections` | Builds the two dummy "Step 1"/"Step 2" sections for the placeholder fallback — currently unused, kept for the next tile that needs a real flow built. |
| `buildPlaceholderFinalStep` | Builds the placeholder final/summary step for the fallback; its "Continue to payment" button is not wired to anything. |

