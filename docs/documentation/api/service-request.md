# `app/api/site/service-request/route.ts`

## Purpose
`POST` — final submission of the homepage "Services" modal
(`ServiceRequestFlow`). Creates an unpriced website order (`priceExVat: 0`,
`status: "processing"`, MANUAL_REVIEW notification) for staff to quote, like
`special-goods-quote`. The job address is stored as `deliveryAddress`;
`productsSummary` is `Service request (<label>)`; the description holds the
service, customer type and job description (`serviceOrderDescription`). Tagged
`websiteOrderKind: "SERVICE"` with the answers in `websiteBookingDetails` (`buildServiceBookingDetails`), so it opens in
the admin `WebsiteOrderModal` where staff quote it (`service-details`). Calls
`welcomeWebsiteOrderCustomer` ("My order" login + order-received email).

Body: `customerType`, `serviceCode`, `customService`, `address`,
`jobDescription`, `preferredDate`, `timeWindow`, `name`, `phone`, `email`,
optional `notes`, honeypot `_hp`. 422 `VALIDATION_FAILED` with per-field
`errors`; 429 on the module-level rate limit (1/min, 20/day).

The older /tjenester page form still posts to `/api/public/manpower`.
