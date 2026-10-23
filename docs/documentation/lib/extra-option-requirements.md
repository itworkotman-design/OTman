# Extra Option Requirements

## Source

- `lib/content/extraOptionRequirements.ts`

## Responsibility

Holds the rule for extras that only make sense together with another extra on the same card (`EXTRA_REQUIRES`). For now there is one: taking the empty pallet (`PALLET_PICKUP`) only together with taking the goods off the pallet (`UNPACKING`, worded that way on half-pallet and pallet).

It is enforced in:

- **Product card** (`WhiteGoodsProductCard`): the pallet pickup row is hidden until unloading is ticked, then shown indented under it in one bordered card (like an install type's add-ons). Unticking unloading also unticks the pickup. A pickup already selected without unloading (booked before the rule) stays visible so it can be unticked; with unloading already booked in "My order", the pickup is listed on its own.
- **Server** (`validateWebsiteOrderCards`): refuses the combination with `EXTRA_OPTION_NOT_ALLOWED`. A "My order" change that keeps a card's extras exactly as booked is let through, so orders booked before the rule stay editable.

## Functions

| Function | Purpose |
|---|---|
| `isExtraOptionAllowed` | Whether an extra code may be selected given the card's selected extra codes. Extras without a rule are always allowed. |
| `dropExtrasMissingRequirement` | The selected extra ids minus any whose required extra is no longer selected. |
| `findCardsWithDisallowedExtraOptions` | Card ids that hold an extra without the extra it requires. |
