# Validate Website Order Cards

## Source

- `lib/orders/validateWebsiteOrderCards.ts`

## Responsibility

The product-card rules every customer-made homepage order must follow. Both the booking route (`app/api/site/white-goods-order`) and the customer's own edit (`app/api/customer/orders/[orderNumber]`) use them.

- Every product must be one the website sells.
- A size-priced product gets its volume bracket from the dimensions the customer entered, and must end up with exactly one volume bracket and one weight bracket.
- An installation-only item must have an installation option chosen.
- A size-priced item must have a plain-text name, which is stored trimmed.

## Functions

| Function | Purpose |
|---|---|
| `validateWebsiteOrderCards` | Returns `{ ok: true, cards }` with the cards as they should be stored, or `{ ok: false, reason }`. The reason is one of `UNKNOWN_PRODUCT`, `SIZE_BRACKETS_REQUIRED`, `INSTALL_OPTION_REQUIRED`, `INSTALL_ADDON_NOT_ALLOWED` (see [install-add-on-requirements.md](install-add-on-requirements.md)) or `ITEM_NAME_REQUIRED`. Optional `previousCards` (a "My order" change) lets a card keep install choices it already had. |
