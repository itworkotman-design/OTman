# Booked Services

## Source

- `app/_components/site/BookingModal/whiteGoods/bookedServices.ts`

## Responsibility

The "only add services" rule for a product card in "My order" within 24h of the job (`lib/orders/customerOrderEditPolicy.ts`), on the client. `WhiteGoodsProductCard` gets the card as booked (`booked`) and runs every change through `keepBookedServices`. A click that would drop a booked service is undone, and so is the card's own clearing of add-ons when the delivery type changes. With `booked` set the card is just the product icon and the additional services that can still be added; delivery, installation and the booked services aren't shown.

## Functions

| Function | Description |
| --- | --- |
| `allowedDeliveryTypes(booked)` | The booked delivery type plus its upgrades (`DELIVERY_UPGRADES` from the policy, so client and server agree): doorstep → carry-in. |
| `isBookedService(booked, optionId)` | Whether an installation, extra or return option is already on the booked card. |
| `hasAddableServices(product, booked)` | Whether the booked card still has an additional-service row left to tick (mirrors the card's row conditions for the booked delivery/installation). `WhiteGoodsBookingFlow` only shows those cards within 24h, hides an options step with none, and drops its calculator there. |
| `keepBookedServices(booked, next)` | `next` with every booked service put back (installation/extra ids, return, dismantling) and the delivery type reset to the booked one unless it's an allowed upgrade. Everything else on the card is left as in `next`. |

`keepBookedServices` still allows a delivery upgrade (`allowedDeliveryTypes`) and installation add-ons, matching the server policy, but the card no longer offers them within 24h.
