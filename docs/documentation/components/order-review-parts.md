# `app/_components/site/BookingModal/whiteGoods/OrderReviewParts.tsx`

## Purpose
The review page's building blocks, shared so every website booking flow's final step looks the same:
the delivery/white-goods flow (`WhiteGoodsBookingFlow`) and the moving flow (`MovingRequestFlow`).

## Components
### `OrderReviewBlocks({ blocks })`
Renders `ReviewBlock`s (`orderReview.ts`) as labelled cards — a location pin on `"location"` blocks, notes keep
their line breaks (`whitespace-pre-line`), blank rows are already left out by the block builders.
### `ReviewTotalFooter({ locale, exVat, vat, incVat, emphasiseExVat })`
`WhiteGoodsOrderSummary`'s `totalFooter` on a review page: subtotal ex. VAT (emphasised for a business customer),
VAT 25 %, and the highlighted total incl. VAT.
