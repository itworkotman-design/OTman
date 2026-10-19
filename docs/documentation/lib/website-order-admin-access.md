# Website Order Admin Access

## Source

- `lib/orders/websiteOrderAdminAccess.ts`

## Responsibility

Who may act on a website order's money: company `OWNER`/`ADMIN`, or anyone
with `WEBSITE_ORDERS` at `ADMIN` level — the same rule as the admin
website-order editor.

## Functions

| Function | Description |
| --- | --- |
| `authorizeWebsiteOrderAdmin` | Returns `{ ok: true, companyId, membership, actor }` (actor ready for order events / lifecycle emails), or `{ ok: false, response }` with 401 `UNAUTHORIZED`, 409 `TENANT_SELECTION_REQUIRED` or 403 `FORBIDDEN`. Used by the decline and refund-difference routes. |
