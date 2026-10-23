# Install Add-on Requirements

## Source

- `lib/content/installAddOnRequirements.ts`

## Responsibility

Holds the rule for install add-ons that never go with particular install types (`ADD_ON_EXCLUDED_TYPES`): "Install integrated front panel" on the upright freezer and the fridge / fridge-freezer is hidden when "Install – freestanding" is picked (still shown with no type or with integrated).

The TV "stand / feet 75"–100"" used to be an add-on that required table mounting 75"–100". It is now its own install type ("On a stand"), so it has no rule here.

The rule is enforced in:

- **Product card** (`WhiteGoodsProductCard`): hides the add-on for the excluded types. Switching type drops it. An add-on that is already selected stays visible so it can be unticked.
- **Server** (`validateWebsiteOrderCards`): refuses the combination with `INSTALL_ADDON_NOT_ALLOWED`. A "My order" change that keeps a card's install choices exactly as booked is let through, so orders booked before the rule stay editable.

## Functions

| Function | Purpose |
|---|---|
| `isInstallAddOnAllowed` | Whether an add-on code may go with the selected install-type code. Add-ons without a rule, or with no type picked, are always allowed. |
| `findCardsWithDisallowedInstallAddOns` | Card ids that hold a restricted add-on together with an install type it excludes. |
