# Admin order state

## Source

- `app/_components/site/BookingModal/whiteGoods/adminOrderState.ts`

## Responsibility

Converts between an existing website order and the booking flow's own state, for the admin editor (`WhiteGoodsBookingFlow` with `admin`).

## Functions

- `pickupStateFromStops({ cards, stops, nameOf })` — the flow's pickup state for the order's stops. The first stop stays in the flow's own top-level fields; every later stop becomes an extra pickup location, and the last one takes whatever is still unassigned. Products go back on their stops by `cardIds`, or for older orders by the product names stored at booking (ignoring the "(×n)" quantity suffix).
- `adminDetailsFromFlow(state)` — the `AdminOrderDetails` save payload: customer, every stop with its card ids and names, delivery, date and time. The distance the editor priced with is sent as `drivingDistanceOverride`, so the order is saved at exactly the price shown.
