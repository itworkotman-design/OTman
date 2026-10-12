# Booked Services

## Source

- `app/_components/site/BookingModal/whiteGoods/bookedServices.ts`

## Responsibility

The "only add services" rule for a product card in "My order" within 24h of the job (`lib/orders/customerOrderEditPolicy.ts`), on the client. `WhiteGoodsProductCard` gets the card as booked (`booked`) and runs every change through `keepBookedServices`. A click that would drop a booked service is undone, and so is the card's own clearing of add-ons when the delivery type changes. The card also shows booked services as ticked and not clickable.

## Functions

| Function | Description |
| --- | --- |
| `allowedDeliveryTypes(booked)` | The booked delivery type plus its upgrades (`DELIVERY_UPGRADES` from the policy, so client and server agree): doorstep → carry-in. |
| `isBookedService(booked, optionId)` | Whether an installation, extra or return option is already on the booked card. |
| `keepBookedServices(booked, next)` | `next` with every booked service put back (installation/extra ids, return, dismantling) and the delivery type reset to the booked one unless it's an allowed upgrade. Everything else on the card is left as in `next`. |

The installation *type* isn't handled here. The card disables every type row while `booked` is set, so it stays as booked, but add-ons for that type can be added.
