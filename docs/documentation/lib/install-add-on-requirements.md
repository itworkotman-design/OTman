# Install Add-on Requirements

## Source

- `lib/content/installAddOnRequirements.ts`

## Responsibility

Holds the rule for install add-ons that only make sense with one particular install type. For now there is one: the TV "stand / feet 75"–100"" add-on, which goes only with table mounting 75"–100", never with wall mounting.

- **Product card** (`WhiteGoodsProductCard`): hides the add-on for other types. Switching type drops it. An add-on that is already selected stays visible so it can be unticked.
- **Server** (`validateWebsiteOrderCards`): refuses the combination with `INSTALL_ADDON_NOT_ALLOWED`. A "My order" change that keeps a card's install choices exactly as booked is let through, so orders booked before the rule stay editable.

## Functions

| Function | Purpose |
|---|---|
| `isInstallAddOnAllowed` | Whether an add-on code may go with the selected install-type code. Add-ons without a rule are always allowed. |
| `findCardsWithDisallowedInstallAddOns` | Card ids that hold a restricted add-on without the install type it needs. |
