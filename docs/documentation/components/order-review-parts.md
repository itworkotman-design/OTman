# `app/_components/site/BookingModal/whiteGoods/OrderReviewParts.tsx`

## Purpose
The review page's building blocks, shared so every website booking flow's final step looks the same:
the delivery/white-goods flow (`WhiteGoodsBookingFlow`) and the moving flow (`MovingRequestFlow`).

## Components
### `OrderReviewBlocks({ blocks, bare })`
Renders `ReviewBlock`s (`orderReview.ts`) as labelled cards — a location pin on `"location"` blocks, notes keep
their line breaks (`whitespace-pre-line`), blank rows are already left out by the block builders. `bare` drops each block's own card (padding only) for a parent that puts them all in one card split by lines — every place that shows them does now: the three homepage review steps, the admin website-order modal and the partner view. A row marked `copy` (`markCopyableRows`, admin panel only) gets a `CopyButton`.
### `ReviewTotalFooter({ locale, exVat, vat, incVat, emphasiseExVat })`
`WhiteGoodsOrderSummary`'s `totalFooter` on a review page: subtotal ex. VAT (emphasised for a business customer),
VAT 25 %, and the highlighted total incl. VAT.
