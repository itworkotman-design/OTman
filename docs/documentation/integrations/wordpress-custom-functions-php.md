# WordPress Custom Functions PHP

## Source

- `app/_components/Dahsboard/booking/orders/WORDPRESS/custom-functions.php`

## Responsibility

Provides legacy WordPress order-table rendering, filters, duplication helpers, and additional save hooks around the `power_order` post type. The file keeps the old app's default status behavior on `Behandles`, sends timezone-safe created and modified timestamps to the new importer, includes attachment metadata, and exposes an admin-only AJAX action that imports the latest 100 modified orders.

## Functions

| Function | Description |
| --- | --- |
| `power_get_order_modal_html` | Builds the legacy WordPress order-history modal markup. |
| `otman_duplicate_power_order` | Clones a legacy `power_order` post and resets selected fields for a new draft order copy. |
| `otman_collect_power_order_attachment_ids` | Recursively collects attachment ids from supported ACF upload field shapes. |
| `otman_extract_power_order_attachments` | Converts collected attachment ids into metadata sent to the new app importer. |
| `otman_power_order_time_iso` | Converts WordPress GMT post timestamps into ISO strings so imported `createdAt` and `updatedAt` are not shifted by local timezone parsing. |
| `otman_send_power_order_sync` | Sends one published `power_order` payload to the new app, including meta, attachments, created time, and modified time. |
| `otman_sync_latest_power_orders` | Sends the latest 100 modified published `power_order` posts to the new app importer. |
| `save_post_power_order` hook | Collects post meta and syncs the legacy WordPress order into the new app without changing the old app's default status semantics. |
| `wp_ajax_otman_sync_latest_power_orders` hook | Allows admins to trigger the latest-100 import batch from WordPress. |
