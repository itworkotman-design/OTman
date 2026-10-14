# `app/_components/site/BookingModal/moving/movingSummary.ts`

## Purpose
Shapes the moving flow's live calculator for the delivery modal's order-summary card
(`WhiteGoodsOrderSummary`): the move is one "product" ("Flytting", subtitle = size) with the size
line and each additional service; the no-lift floor surcharge is listed under the card's order
extras, one row per end ("Etasjetillegg, fra" × floors), as is the carrying-distance surcharge (`carryLines`, e.g. "Bæreavstand: lenger unna, til"). Prices ex. VAT in kroner — the card applies The driving-distance charge (`distanceLines`, from `movingDistanceLines`) is one more extras row, "Kjøring (35 km)" / "Distance (35 km)".
the VAT mode. Tested in `movingSummary.test.ts`.

## Functions
### `movingSummary({ locale, sizeOption, services, floorLines })`
`{ products, orderExtras }`; both empty until a size is picked (the card is passed `hideProductHints`, so it then shows just the heading and a 0 kr total).
