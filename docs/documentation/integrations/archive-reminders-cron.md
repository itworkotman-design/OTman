# Archive Reminders Cron

## Source

- `app/api/cron/archive-reminders/route.ts`
- `app/api/archive/reminders/generate-now/route.ts`
- `lib/docArchive/reminderRecurrence.ts`
- `lib/docArchive/reminderNotes.ts`

## Responsibility

Same shape as the Scheduler Orders recurring-order templates
(`docs/documentation/integrations/scheduler-orders-cron.md`): there is no
in-process scheduler, so a looping reminder only actually advances when
something calls `POST /api/cron/archive-reminders`.

A folder/item reminder can optionally be given a recurrence rule (set from
the folder/item settings page, alongside the reminder description) via
`PATCH /api/archive/folders/[folderId]/reminder-settings` or the item
equivalent — `recurrenceType` (`WEEKLY` | `MONTHLY` | `CUSTOM_DATES`, or
`null` for no recurrence) and `recurrenceConfig` (a JSON shape depending on
type — see `lib/orders/recurringOrders/occurrenceDates.ts`: `{ weekdays }`,
`{ dayOfMonth }`, or `{ dates }`). This is the exact same enum and config
shapes `RecurringOrderTemplate` uses, stored instead in OTman's own
`ArchiveFolderReminderNote`/`ArchiveItemReminderNote` tables — the
`@customprojects/custom-archive` package itself has no recurrence concept,
only a single `dueAt`. `isRecurrenceConfigValid`/`matchesRecurrence` from the
Scheduler Orders code are reused as-is rather than duplicated, since they're
already pure functions of `(date, type, config)` with nothing order-specific
baked in.

`advanceDueArchiveReminders()` scans every reminder note with a
`recurrenceType` set, and for any whose target's current `dueAt` is today or
in the past (Europe/Oslo calendar date), scans forward day-by-day (capped at
`MAX_DAYS_SCANNED`, same safety cap as `computeUpcomingOccurrenceDates`) for
the next date the rule matches, then calls `archive.setFolderDates`/
`setItemDates` to persist it as the new `dueAt`. If no future match is found
(e.g. a `CUSTOM_DATES` reminder whose configured dates are all in the past),
it's left as-is rather than erroring — the target just stays overdue until
its recurrence is edited. The recurring order templates need a separate
`RecurringOrderOccurrence` idempotency table because generating an
occurrence creates a brand new `Order` that must never be duplicated; this
doesn't need one, because re-deriving "the next matching date after today"
converges to the same value no matter how many times or how late it runs —
running the sweep twice in the same day is a no-op the second time.

The `ctx.userId` used for `setFolderDates`/`setItemDates` is the target's own
`createdByUserId` — `createFolder`/`createItem` only auto-grant
`manage_metadata` to the creator (see the custom-archive-integration notes),
so reusing that id is what makes the call authorized without any extra
permission plumbing or per-company "pick an actor" logic.

Same auth split as the recurring-orders cron: `POST /api/cron/archive-reminders`
is `CRON_SECRET` Bearer-authenticated for an external scheduler, while
`POST /api/archive/reminders/generate-now` is session-authenticated
(OWNER/ADMIN only, scoped to the caller's own company) and backs the
"Run reminder check now" button on the archive root page's reminders panel.

## Render deployment (manual step)

Same pattern as `scheduler-orders-cron.md` — set up a Render Cron Job hitting
`POST /api/cron/archive-reminders` with the same `CRON_SECRET` bearer token,
on whatever schedule matches how promptly loops should re-fire (e.g. once
daily). Not yet wired up in Render as of this writing.
