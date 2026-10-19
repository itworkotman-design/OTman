# Website Order Modal

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderModal.tsx`

## Responsibility

A read-only admin view of a homepage white-goods website order, laid out like the customer's own summary page. It's opened by `DashboardOrderModal`.

- **Header:** "Editing website order - {displayId}".
- **Left column:** one card holding the `buildOrderReviewBlocks` sections (every pickup stop, the delivery, and the customer's details with their comments) split by thin lines, with logo-blue titles and a pin on the location sections. Status notes appear as the last section when set.
- **Right column:** `WebsiteOrderCalculator` for `order.calculator` (customer side, partner side for admins, discount/extra and partner minus/plus inputs). When the order can't be priced (`calculator` is null) it falls back to the stored products grouped per card, the order extras and the totals, shown ex. VAT as stored, with the same layout as the calculator (Total ex. VAT, VAT, and Total incl. VAT, which is what the customer pays, `payment.currentTotalIncVatNok`).
- **Send new login:** a header button (`WebsiteOrderCustomerLoginButton`), shown only when the order has an email and no live "My order" login for it (`hasCustomerLogin` from website-details). It hides itself once it has sent one. A customer who already has a login gets password help under User management → Website users. After a confirm, it emails the customer a new "My order" password (`POST /api/orders/[orderId]/customer-login`). The account is recreated if it was already deleted. The result shows as the notice.
- **Tabs:** while the order is editable (not cancelled, completed, invoiced or paid), a tab bar under the header switches between **Overview** (everything below) and **Edit order** (`WebsiteOrderEditTab`). Leaving Overview with unsaved calculator changes, or Edit with unsaved edits, asks first; closing the modal with unsaved edits does too. After a save it reloads the order, goes back to Overview and shows a green notice.
- **Left column:** below the order details and status notes comes the `WebsiteOrderAdminActions` ("Handle order") card, with `WebsiteOrderAttachments` inside it below a divider.
- **Right column:** only Payment and the calculator. The calculator gets the four adjustment fields of `order.handling`; "Handle order" is keyed on the rest, so saving one doesn't reset unsaved edits in the other.
- **Payment panel:** `WebsiteOrderPaymentSummary` for `order.payment`, at the top of the right column.
- **Price warnings:** if `totalsCheck` finds a problem, a red banner at the top spells it out ("the customer was shown X but the total is Y", or "the lines add up to X but the total is Y"). A red "Not covered by the lines above" row also appears above the totals.
- **Delete order:** one button (`deleteButton`), shown only with `canDelete`. It sits left of Save on both tabs: passed as `besideSave` to `WebsiteOrderAdminActions` (Overview) and to `WebsiteOrderEditTab` (Edit order). It uses the same `DELETE /api/orders/[orderId]` as `OrderModal`. A delete error shows in the left column on the Overview, and as a banner above the form on the edit tab. There is deliberately no way into the regular `OrderModal`/`BookingEditor` from here: it prices with the dashboard catalog and would break a website order. All editing goes through the "Edit order" tab.

Moves: `kind: "moving"` orders show their two ends + timing (`buildMovingReviewBlocks`) and the same `WebsiteOrderCalculator` as a delivery (`movingOrderCalculatorView`: codes, partner side, set to 0, discount/extra, partner minus/plus, and "Use new price" from `currentPricesTotal`/`priceChanges`), previewing through `/api/orders/[orderId]/moving-details` (`previewEndpoint`). The Edit tab is `MovingOrderEditTab`, with that calculator too. The "Handle order" panel saves (with the calculator draft) through `moving-details`, without express or the deviation.

Service requests: `kind: "service"` orders show each service with its job, where and timing (`buildServiceReviewBlocks`) and the same calculator (`serviceOrderCalculatorView`: one quote line per service as "Service", express/deviation as order extras; no "Use new price"), previewing and saving "Handle order" through `/api/orders/[orderId]/service-details`. An amber notice names the services not quoted yet. The Edit tab is `ServiceOrderEditTab` (services with their quotes, address, schedule, customer).
