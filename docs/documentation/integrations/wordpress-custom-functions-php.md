# WordPress Custom Functions PHP

## Source

- `app/_components/Dahsboard/booking/orders/WORDPRESS/custom-functions.php`

## Responsibility

Provides legacy WordPress order-table rendering, filters, duplication helpers, and additional save hooks around the `power_order` post type. The file keeps the old app’s default status behavior on `Behandles` and leaves `processing` to the new booking app after import normalization.

## Functions

| Function | Description |
| --- | --- |
| `power_get_order_modal_html` | Builds the legacy WordPress order-history modal markup. |
| `otman_duplicate_power_order` | Clones a legacy `power_order` post and resets selected fields for a new draft order copy. |
| `save_post_power_order` hook | Collects post meta and syncs the legacy WordPress order into the new app without changing the old app’s default status semantics. |
