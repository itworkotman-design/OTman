# Prisma Schema

## Source

- `prisma/schema.prisma`

## Responsibility

Defines the application database models and relations used by Prisma Client.

## Functions

This file does not define functions.

## Notes

- `Order.orderCreatorEmailReadAt` stores when an order creator last marked admin replies as read, without clearing admin-facing inbound mail alerts.
- `OrderEmailStatus.SENT_WITH_SYNC_WARNING` marks Gmail messages that were accepted by `messages.send` but had a post-send metadata lookup warning.
- `User.languagePreference` stores an optional dashboard language override as `EN` or `NO`; role-based defaults are used when it is empty.
