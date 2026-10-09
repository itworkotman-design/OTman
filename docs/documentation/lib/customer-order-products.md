# Customer Order Products

## Source

- `lib/customerAccounts/customerOrderProducts.ts`
- `findCustomerOrderProducts` in `lib/customerAccounts/customerOrderView.ts`

## Responsibility

The products on a customer's order for the "Varer og tjenester" tiles on the My order page: one entry per product card (the order's `PRODUCT_CARD` lines), in card order, with `code` and `iconKey` (`Product.iconKey`, looked up by `findCustomerOrderProducts`) for `ProductIcon`, the catalog name (localized when shown), the count, — for the catch-all "Other furniture" — what the customer called the item (`itemName`), the card's delivery type label, and its services: the card's INSTALL / EXTRA / RETURN option labels, once each, leaving out the lines that price the delivery itself (`rawData.source` delivery_type_price, white_goods_extra_unit, auto_delivery_price(_xtra)) and labour-hour BASE_OPTION lines. Labels are the stored (English) ones — localize when showing them.
