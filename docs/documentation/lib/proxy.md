# Proxy

## Source

- `proxy.ts`

## Responsibility

Handles edge redirects before route rendering. It redirects legacy `/client-login` paths to `/login`, skips API and authenticated dashboard routes, and prefixes public site paths with the default locale when no locale is present.

## Functions

| Function | Description |
| --- | --- |
| `proxy` | Redirects `/client-login` to `/login`, lets excluded app/API paths pass through, and redirects public non-localized paths to the default locale. |
