# Late Change Sections

## Source

- `app/_components/site/BookingModal/whiteGoods/PickupContactPersonsCard.tsx`

## Responsibility

One of the sections `WhiteGoodsBookingFlow` shows in "My order" within 24h of the job, when only contact details and added services can change.

- **`PickupContactPersonsCard({ locale, stops })`**: a name and phone field for the contact person at each private or business pickup. The flow leaves store pickups out, and hides the section when every pickup is a store. Each stop (`PickupContactPerson`) carries its title, address, current values and change handlers.
