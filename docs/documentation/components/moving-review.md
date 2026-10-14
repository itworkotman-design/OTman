# `app/_components/site/BookingModal/moving/movingReview.ts`

## Purpose
The text half of the moving flow's review page, in the delivery review's `ReviewBlock` shape
(`whiteGoods/orderReview.ts`) so it renders through the same `OrderReviewBlocks` cards. Tested in
`movingReview.test.ts`.

## Functions
### `buildMovingReviewBlocks(locale, input)`
Four blocks: "Flytter fra" / "Flytter til" (`location`: address, property type, size, number of floors, which floor
+ lift for apartments/offices — the lift left out when unanswered on floor 1 — and parking), "Tidspunkt" (`details`:
preferred date, time window, driving distance) and "Dine opplysninger" (`contact`). Blank answers are left out.
