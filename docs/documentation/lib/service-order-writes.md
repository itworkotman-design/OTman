# `lib/orders/serviceOrderWrites.ts`

## Purpose
`serviceOrderItemWrites(orderId, itemRows, data)` — a service request's lines (`SERVICE_ITEM_PRODUCT_CODES`: quote, express,
deviation) replaced and the order updated, as one `$transaction` array. Shared by the admin edit (`service-details`) and
"My order" (`app/api/customer/orders/[orderNumber]`).
