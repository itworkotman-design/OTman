# Dashboard Booking Create Page

## Source

- `app/(User)/dashboard/booking/create/page.tsx`

## Responsibility

Renders the admin dashboard booking creation page and passes the current user's saved language into `BookingEditor`.

## Functions

| Function | Description |
| --- | --- |
| `CreateBookingPage` | Loads the current user's booking UI language, submits new orders, localizes the success/error text, and renders `BookingEditor` with the selected locale. |
