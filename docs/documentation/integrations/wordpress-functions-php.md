# WordPress Functions PHP

## Source

- `app/_components/Dahsboard/booking/orders/WORDPRESS/functions.php`

## Responsibility

Handles the legacy WordPress `power_order` save flow, customer and admin emails, and the outbound sync payload sent from the old app to the new booking app. The legacy WordPress side keeps `Behandles` as its fallback status while the receiving app normalizes imported statuses independently.

## Functions

| Function | Description |
| --- | --- |
| `val` | Reads an ACF value from the submitted payload first and falls back to the stored field value. |
| `otm_add_status_wrapper` | Adds a status-based CSS class to the legacy ACF status field wrapper. |
| `save_post` hook | Builds email content and posts the legacy order payload to the Next.js WordPress import route after a WordPress order save. |
| `save_post_power_order` hook | Ensures a published legacy WordPress order gets the legacy fallback status `Behandles` when no status has been stored yet. |

