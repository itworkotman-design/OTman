# Booking Create Page

## Source

- `app/(User)/booking/create/page.tsx`

## Responsibility

Renders the order-creator booking creation page with role-based access and the current user's saved booking UI language.

## Functions

| Function | Description |
| --- | --- |
| `BookingCreatePage` | Checks create-order access, translates page state through the saved user language, submits new orders, and renders `BookingEditor` with creator-only fields hidden. |
