# Website Order Edit Panel

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderEditPanel.tsx`

## Responsibility

The Alert Center's (`OrderEmailModal`) "Edit order" tab for a homepage order. It loads the order with `useResolvedOrder` and shows `WebsiteOrderPanel`, so staff switch between the order and its Conversation / SMS / Order history / Notifications tabs in one modal. After an admin action it reloads in place and calls `onSaved`. An order that turns out not to be a website order gets the regular `OrderEditPanel`. A failed load shows an error with "Try again", and never falls back to the regular editor. Passes `onUnsavedChange` through so the Alert Center can confirm before closing.
