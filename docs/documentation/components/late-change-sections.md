# Late Change Sections

## Source

- `app/_components/site/BookingModal/whiteGoods/LateChangeLockedSummary.tsx`
- `app/_components/site/BookingModal/whiteGoods/PickupContactPersonsCard.tsx`

## Responsibility

Two of the sections `WhiteGoodsBookingFlow` shows in "My order" within 24h of the job, when only contact details and added services can change.

- **`LateChangeLockedSummary({ locale, blocks })`**: a note that the date, addresses and products can no longer be changed here, followed by the booked stops and delivery (with date and time) as read-only blocks and `ContactUsCard`. The flow passes the location blocks from `buildOrderReviewBlocks`, with the contact persons and driving distance left out.
- **`PickupContactPersonsCard({ locale, stops })`**: a name and phone field for the contact person at each private or business pickup. The flow leaves store pickups out, and hides the section when every pickup is a store. Each stop (`PickupContactPerson`) carries its title, address, current values and change handlers.
