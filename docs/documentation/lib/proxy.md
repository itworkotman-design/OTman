# Proxy

## Source

- `proxy.ts`

## Responsibility

Handles edge routing before route rendering. It lets legacy `/client-login` render its own login page, skips API and authenticated dashboard routes, and prefixes public site paths with the default locale when no locale is present.

## Functions

| Function | Description |
| --- | --- |
| `proxy` | Lets excluded app/API paths, including `/client-login`, pass through and redirects public non-localized paths to the default locale. |
