# Code Documentation

## Purpose

This folder stores short, file-focused documentation for the codebase.

## Structure

- `api/`: Next.js route handlers and other server-facing endpoints.
- `components/`: React components and UI-specific helpers.
- `lib/`: Shared business logic and utility modules.
- `integrations/`: Third-party service integrations and adapters.

## Format

Each documentation file should include:

1. Source file path
2. File responsibility
3. Function list with a short description for each function

## External APIs

- [GmailAPI] OAuth account: itworkotman@gmail.com — sends as bestilling@otman.no. Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GMAIL_ACCOUNT_EMAIL`, `GMAIL_SEND_AS_EMAIL`
- [Mapbox] Address autocomplete + route distance calculation. Env var: `MAPBOX_ACCESS_TOKEN`. Google Cloud project: "Otman" (itworkotman@gmail.com), 500 free then 3$ for every 1000
- [Brevo] Outbound transactional email (password resets, bulk order emails). Env vars: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- [Cloudflare Email Routing] Inbound email — receives customer replies to `reply+<token>@otman.no`, a Worker forwards them as JSON to `/api/integrations/email/inbound`. Env vars: `EMAIL_REPLY_DOMAIN`, `EMAIL_INBOUND_SECRET`. See `docs/cloudflare-email-routing.md`
- [GSM Tasks] Task/delivery management at api.gsmtasks.com. Env vars: `GSM_API_BASE`, `GSM_USERNAME`, `GSM_PASSWORD`
- [WordPress] Legacy order import and attachment storage. Env vars: `WORDPRESS_*`

## External connections

- [PostgreSQL] Primary database via Prisma. Env var: `DATABASE_URL`
- [AWS-S3] Cloud storage for POD files and media — region eu-north-1. Console: https://eu-north-1.console.aws.amazon.com/s3/buckets?region=eu-north-1 — Env vars: `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- [GmailAPI] Main order email flows — sending from order view, contact form, inbound reply sync
- [Brevo] Password reset emails and bulk select email sending
- [Cloudflare-Email-Routing] Inbound customer reply emails via Worker → `/api/integrations/email/inbound`
- [GSM-Tasks] Pushes orders to GSM for task dispatching, receives webhook on completion
- [WordPress] Inbound order webhook (otman.no WooCommerce), attachment backfill scripts
- [Mailgun] Legacy — inbound route still parses its form-data format as a fallback but production uses Cloudflare

## Current Entries

### API Routes

- [API: address search](./api/address-search.md)
- [API: auth heartbeat](./api/auth-heartbeat-route.md)
- [API: booking catalog](./api/booking-catalog-route.md)
- [API: dashboard finish month](./api/dashboard-home-finish-month-route.md)
- [API: dashboard home stats](./api/dashboard-home-route.md)
- [API: email inbound](./api/email-inbound-route.md)
- [API: feature request](./api/feature-request-route.md)
- [API: Gmail sync](./api/gmail-sync-route.md)
- [API: GSM webhook](./api/gsm-webhook-route.md)
- [API: health check](./api/health-route.md)
- [API: invite accept](./api/invite-accept-route.md)
- [API: invite create](./api/invites-create-route.md)
- [API: invite revoke](./api/invite-revoke-route.md)
- [API: login](./api/login-route.md)
- [API: logout](./api/logout-route.md)
- [API: logout all](./api/logout-all-route.md)
- [API: me](./api/me-route.md)
- [API: me language](./api/me-language-route.md)
- [API: membership disable](./api/membership-disable-route.md)
- [API: membership enable](./api/membership-enable-route.md)
- [API: membership role](./api/membership-role-route.md)
- [API: membership update](./api/membership-update-route.md)
- [API: memberships](./api/memberships-route.md)
- [API: memberships disable](./api/memberships-disable-route.md)
- [API: order attachment delete](./api/order-attachment-delete.md)
- [API: order attachment delete by order](./api/order-attachment-delete-by-order.md)
- [API: order attachment download](./api/order-attachment-download.md)
- [API: order attachments by order](./api/order-attachments-by-order.md)
- [API: order attachments index](./api/order-attachments-index.md)
- [API: order by id](./api/order-by-id.md)
- [API: order contact](./api/order-contact-route.md)
- [API: order creators](./api/order-creators-route.md)
- [API: order emails](./api/order-emails-route.md)
- [API: order history](./api/order-history-route.md)
- [API: order notifications](./api/order-notifications-route.md)
- [API: orders bulk](./api/orders-bulk-route.md)
- [API: orders capacity](./api/orders-capacity-route.md)
- [API: orders duplicate](./api/orders-duplicate-route.md)
- [API: orders GDPR anonymize](./api/orders-gdpr-anonymize-route.md)
- [API: orders route](./api/orders-route.md)
- [API: orders send selected email](./api/orders-send-selected-email-route.md)
- [API: orders send to GSM](./api/orders-send-to-gsm-route.md)
- [API: password reset complete](./api/password-reset-complete-route.md)
- [API: password reset request](./api/password-reset-request-route.md)
- [API: pending order attachments](./api/pending-order-attachments.md)
- [API: pending order attachment download](./api/pending-order-attachment-download.md)
- [API: pending order attachment delete](./api/pending-order-attachment-delete.md)
- [API: products pricelist by id](./api/products-pricelist-by-id-route.md)
- [API: products pricelist items](./api/products-pricelist-items-route.md)
- [API: products pricelist products](./api/products-pricelist-products-route.md)
- [API: products pricelist special options](./api/products-pricelist-special-options-route.md)
- [API: products pricelists](./api/products-pricelists-route.md)
- [API: public contact](./api/public-contact-route.md)
- [API: public manpower](./api/public-manpower-route.md)
- [API: public request](./api/public-request-route.md)
- [API: route distance](./api/route-distance-route.md)
- [API: session revoke](./api/session-revoke-route.md)
- [API: sessions](./api/sessions-route.md)
- [API: signup](./api/signup-route.md)
- [API: subcontractors](./api/subcontractors-route.md)
- [API: tenant select](./api/tenant-select-route.md)
- [API: upload route](./api/upload-route.md)
- [API: user create](./api/users-create-route.md)
- [API: user logo upload](./api/user-logo-route.md)
- [API: WordPress orders](./api/wordpress-orders-route.md)

### Components — Dashboard

- [Component: address autocomplete input](./components/address-autocomplete-input.md)
- [Component: booking archive table](./components/booking-archive-table.md)
- [Component: booking calculator panel](./components/booking-calculator-panel.md)
- [Component: booking column visibility modal](./components/booking-column-visibility-modal.md)
- [Component: booking create page](./components/booking-create-page.md)
- [Component: booking editor](./components/booking-editor.md)
- [Component: booking field editor](./components/booking-field-editor.md)
- [Component: booking filters](./components/booking-filters.md)
- [Component: booking navbar](./components/booking-navbar.md)
- [Component: bulk update bar](./components/bulk-update-bar.md)
- [Component: calculator display](./components/calculator-display.md)
- [Component: dashboard booking create page](./components/dashboard-booking-create-page.md)
- [Component: dashboard home](./components/dashboard-home.md)
- [Component: edit prices page](./components/edit-prices-page.md)
- [Component: feature request modal](./components/feature-request-modal.md)
- [Component: language switch button](./components/language-switch-button.md)
- [Component: login page](./components/login-page.md)
- [Component: message sender](./components/message-sender.md)
- [Component: not found](./components/not-found.md)
- [Component: order attachments section](./components/order-attachments-section.md)
- [Component: order creator contact modal](./components/order-creator-contact-modal.md)
- [Component: order email modal](./components/order-email-modal.md)
- [Component: order fields form](./components/order-fields-form.md)
- [Component: order modal](./components/order-modal.md)
- [Component: pickup locations](./components/pickup-locations.md)
- [Component: product card](./components/product-card.md)
- [Component: read only order modal](./components/read-only-order-modal.md)
- [Component: selection action bar](./components/selection-action-bar.md)
- [Component: session heartbeat](./components/session-heartbeat.md)
- [Component: sidebar](./components/sidebar.md)
- [Component: top filters field](./components/top-filters-field.md)
- [Component: user auth navbar](./components/user-auth-navbar.md)
- [Component: user management page](./components/user-management-page.md)
- [Component: user modal](./components/user-modal.md)
- [Component: user navbar](./components/user-navbar.md)

### Components — Site (public)

- [Component: about page](./components/about-page.md)
- [Component: blog page](./components/blog-page.md)
- [Component: car rental details page](./components/car-rental-details-page.md)
- [Component: car rental page](./components/car-rental-page.md)
- [Component: contact page](./components/contact-page.md)
- [Component: home page](./components/home-page.md)
- [Component: legal page](./components/legal-page.md)
- [Component: partners display](./components/partners-display.md)
- [Component: service modal](./components/service-modal.md)
- [Component: service window](./components/service-window.md)
- [Component: service window item](./components/service-window-item.md)
- [Component: site footer](./components/site-footer.md)
- [Component: site google map](./components/site-google-map.md)
- [Component: site language switcher](./components/site-language-switcher.md)
- [Component: site navbar](./components/site-navbar.md)
- [Component: stats display](./components/stats-display.md)
- [Component: tjenester](./components/tjenester.md)
- [Component: tjenester route](./components/tjenester-route.md)
- [Component: vehicle card](./components/vehicle-card.md)
- [Component: vehicle gallery](./components/vehicle-gallery.md)

### Lib — Auth

- [Lib: auth event](./lib/auth-event.md)
- [Lib: auth init](./lib/auth-init.md)
- [Lib: create session](./lib/create-session.md)
- [Lib: invite delivery](./lib/invite-delivery.md)
- [Lib: invite revoke](./lib/invite-revoke.md)
- [Lib: invite token](./lib/invite-token.md)
- [Lib: invite accept](./lib/invite-accept.md)
- [Lib: invite create](./lib/invite-create.md)
- [Lib: login](./lib/login.md)
- [Lib: membership](./lib/membership.md)
- [Lib: password](./lib/password.md)
- [Lib: password reset brevo](./lib/password-reset-brevo.md)
- [Lib: password reset complete](./lib/password-reset-complete.md)
- [Lib: password reset delivery](./lib/password-reset-delivery.md)
- [Lib: password reset request](./lib/password-reset-request.md)
- [Lib: password reset token](./lib/password-reset-token.md)
- [Lib: rate limit](./lib/rate-limit.md)
- [Lib: register invite delivery](./lib/register-invite-delivery.md)
- [Lib: session](./lib/session.md)
- [Lib: session token](./lib/session-token.md)
- [Lib: signup](./lib/signup.md)
- [Lib: tenant select](./lib/tenant-select.md)

### Lib — Booking & Orders

- [Lib: booking archive columns](./lib/booking-archive-columns.md)
- [Lib: booking catalog](./lib/booking-catalog.md)
- [Lib: booking constants](./lib/booking-constants.md)
- [Lib: booking UI text](./lib/booking-ui-text.md)
- [Lib: build order items from cards](./lib/build-order-items-from-cards.md)
- [Lib: create order view](./lib/create-order-view.md)
- [Lib: custom sections](./lib/custom-sections.md)
- [Lib: delivery types](./lib/delivery-types.md)
- [Lib: deviation fees](./lib/deviation-fees.md)
- [Lib: export orders to Excel](./lib/export-orders-to-excel.md)
- [Lib: hardcoded fees](./lib/hardcoded-fees.md)
- [Lib: normalize order input](./lib/normalize-order-input.md)
- [Lib: order alerts](./lib/order-alerts.md)
- [Lib: order form visibility](./lib/order-form-visibility.md)
- [Lib: price list settings](./lib/price-list-settings.md)
- [Lib: pricing snapshot](./lib/pricing-snapshot.md)
- [Lib: pricing types](./lib/pricing-types.md)
- [Lib: shared delivery logic](./lib/shared-delivery-logic.md)
- [Lib: WordPress read-only cleanup](./lib/wordpress-readonly-cleanup.md)

### Lib — Content (site copy)

- [Lib: about content](./lib/about-content.md)
- [Lib: blog content](./lib/blog-content.md)
- [Lib: car rental content](./lib/car-rental-content.md)
- [Lib: contact content](./lib/contact-content.md)
- [Lib: footer content](./lib/footer-content.md)
- [Lib: home page content](./lib/home-page-content.md)
- [Lib: legal content](./lib/legal-content.md)
- [Lib: navbar content](./lib/navbar-content.md)
- [Lib: partners content](./lib/partners-content.md)
- [Lib: service window content](./lib/service-window-content.md)
- [Lib: stats content](./lib/stats-content.md)
- [Lib: tjenester content](./lib/tjenester-content.md)
- [Lib: transport request config](./lib/transport-request-config.md)

### Lib — Email

- [Lib: build invite email](./lib/build-invite-email.md)
- [Lib: build password reset request](./lib/build-password-reset-request.md)
- [Lib: email assets](./lib/email-assets.md)
- [Lib: Gmail accounts](./lib/gmail-accounts.md)
- [Lib: Gmail sync](./lib/gmail-sync.md)
- [Lib: send email](./lib/send-email.md)
- [Lib: send Gmail email](./lib/send-gmail-email.md)

### Lib — General

- [Lib: attachment categories](./lib/attachment-categories.md)
- [Lib: catalog](./lib/catalog.md)
- [Lib: chart utils](./lib/chart-utils.md)
- [Lib: database client](./lib/db.md)
- [Lib: date display](./lib/date-display.md)
- [Lib: finish month workbook](./lib/finish-month-workbook.md)
- [Lib: order attachment storage](./lib/order-attachment-storage.md)
- [Lib: Prisma schema](./lib/prisma-schema.md)
- [Lib: profile appearance](./lib/profile-appearance.md)
- [Lib: proxy](./lib/proxy.md)
- [Lib: search normalization](./lib/search-normalization.md)
- [Lib: site stats](./lib/site-stats.md)
- [Lib: use current user](./lib/use-current-user.md)
- [Lib: user create](./lib/user-create.md)
- [Lib: user language](./lib/user-language.md)
- [Lib: user modal helpers](./lib/user-modal.md)
- [Lib: user types](./lib/user-types.md)
- [Lib: vehicles](./lib/vehicles.md)
- [Lib: WordPress attachment storage](./lib/wordpress-attachment-storage.md)

### Integrations

- [Integration: GSM build order payload](./integrations/gsm-build-order-payload.md)
- [Integration: GSM client](./integrations/gsm-client.md)
- [Integration: GSM download POD PDF](./integrations/gsm-download-pod-pdf.md)
- [Integration: GSM fetch task](./integrations/gsm-fetch-task.md)
- [Integration: GSM missing POD attachment recovery](./integrations/gsm-missing-pod-attachment-recovery.md)
- [Integration: GSM POD attachment backfill](./integrations/gsm-pod-attachment-backfill.md)
- [Integration: GSM resolve file URL](./integrations/gsm-resolve-file-url.md)
- [Integration: GSM send order](./integrations/gsm-send-order.md)
- [Integration: Mapbox route distance](./integrations/mapbox-route-distance.md)
- [Integration: WordPress attachment backfill](./integrations/wordpress-attachment-backfill.md)
- [Integration: WordPress catalog mapping](./integrations/wordpress-catalog-mapping.md)
- [Integration: WordPress catalog mapping config](./integrations/wordpress-catalog-mapping-config.md)
- [Integration: WordPress order import](./integrations/wordpress-order-import.md)
- [Integration: WordPress order meta](./integrations/wordpress-order-meta.md)
