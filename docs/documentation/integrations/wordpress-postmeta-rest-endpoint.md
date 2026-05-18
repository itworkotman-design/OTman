# WordPress Postmeta REST Endpoint

## Source

- `docs/WORDPRESS/otman-postmeta-rest-endpoint.php`

## Responsibility

Small installable WordPress plugin for the old site. It exposes authenticated REST endpoints for checking plugin availability and returning raw postmeta rows from `21gLt_postmeta` for historical `power_order` imports. Access requires a logged-in user with `manage_options` or a shared secret through the `x-otman-postmeta-secret` header or `secret` query parameter.

## Functions

| Function | Description |
| --- | --- |
| `otman_postmeta_rest_secret` | Reads the shared secret from `OTMAN_POSTMETA_REST_SECRET` constant or environment variable. |
| `otman_postmeta_rest_request_secret` | Reads the request secret from the header or query parameter. |
| `otman_postmeta_rest_permission` | Allows admins or requests with a matching shared secret. |
| `otman_postmeta_rest_normalize_table_prefix` | Validates the optional table prefix and defaults to `21gLt_`. |
| `otman_postmeta_rest_ping` | Returns a small authenticated health response for `/wp-json/otman/v1/ping`. |
| `otman_postmeta_rest_get_postmeta` | Queries `{table_prefix}postmeta` by `post_id` and returns `{ meta_key, meta_value }` rows. |
| `rest_api_init` callback | Registers `GET /otman/v1/ping` and `GET /otman/v1/postmeta`. |
