# Service Window

## Source

- `app/_components/site/TransportService/ServiceWindow.tsx`

## Responsibility

Renders the home page service carousel/grid (4 tiles: doorstep delivery, delivery +
assembly, assembly-only, and moving). Clicking a tile opens a modal — it does not
route to a page. The first three tiles (any tile resolving to the `collection-pickup`
service id) all open `WhiteGoodsBookingFlow`, the real data-backed white-goods +
furniture booking flow. The fourth tile ("Flytting"/Moving, `moving-relocation`)
currently opens a bare `SteppedModal` filled with hard-coded placeholder content
(`buildPlaceholderSections`/`buildPlaceholderFinalStep` in this file) — it has no
real fields or submission logic yet; see
`docs/homepage-ordering-roadmap.md` §6 for the planned replacement.

An older single-page modal, `ServiceModal.tsx`, is commented out of this file and no
longer rendered; see `docs/homepage-ordering-roadmap.md` §3a for its status.

## Functions

| Function | Description |
| --- | --- |
| `ServiceWindow` | Renders localized service cards, handles carousel scroll/snap behavior, and opens the appropriate modal (`WhiteGoodsBookingFlow` or the placeholder `SteppedModal`) per tile. |
| `buildPlaceholderSections` | Builds the two dummy "Step 1"/"Step 2" sections used by the Moving tile's placeholder modal — replace once Moving has a real flow. |
| `buildPlaceholderFinalStep` | Builds the placeholder final/summary step for the Moving tile's modal; its "Continue to payment" button is not wired to anything yet. |

