# Website Order Modal

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderModal.tsx`

## Responsibility

A read-only admin view of a homepage white-goods website order, laid out like the customer's own summary page. It's opened by `DashboardOrderModal`.

- **Header:** website order number, display id, status, customer type and created date.
- **Left column:** cards from `buildOrderReviewBlocks` (every pickup stop, the delivery, and the customer's details with their comments), with logo-blue titles and a pin on the location cards. Status notes appear when set.
- **Right column:** `WebsiteOrderCalculator` for `order.calculator` (customer side, partner side for admins, discount/extra and partner minus/plus inputs). When the order can't be priced (`calculator` is null) it falls back to the stored products grouped per card, the order extras and the VAT breakdown.
- **Send new login:** a header button (`WebsiteOrderCustomerLoginButton`), shown only when the order has an email and no live "My order" login for it (`hasCustomerLogin` from website-details). It hides itself once it has sent one. A customer who already has a login gets password help under User management → Website users. After a confirm, it emails the customer a new "My order" password (`POST /api/orders/[orderId]/customer-login`). The account is recreated if it was already deleted. The result shows as the notice.
- **Edit order:** a header button (hidden once the order is cancelled, completed, invoiced or paid) opens the customer's own booking modal on top, in admin mode (`WhiteGoodsBookingFlow` with `admin`): prefilled from the order, every section open, nothing required, and `WebsiteOrderAdminFooter` as its save bar. After a save, the modal reloads the order and shows a green notice.
- **Left column:** below the order details and status notes come the `WebsiteOrderAdminActions` ("Handle order") panel, then `WebsiteOrderAttachments`.
- **Right column:** only Payment and the calculator. The calculator gets the four adjustment fields of `order.handling`; "Handle order" is keyed on the rest, so saving one doesn't reset unsaved edits in the other.
- **Payment panel:** `WebsiteOrderPaymentSummary` for `order.payment`, at the top of the right column.
- **Price warnings:** if `totalsCheck` finds a problem, a red banner at the top spells it out ("the customer was shown X but the total is Y", or "the lines add up to X but the total is Y"). A red "Not covered by the lines above" row also appears above the totals.
- **Footer:** "Delete order", only with `canDelete`, using the same `DELETE /api/orders/[orderId]` as `OrderModal`. There is deliberately no way into the regular `OrderModal`/`BookingEditor` from here: it prices with the dashboard catalog and would break a website order. All editing goes through "Edit order".
