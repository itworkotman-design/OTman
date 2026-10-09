# Order Progress

## Source

- `lib/customerAccounts/orderProgress.ts`

## Responsibility

`buildOrderProgress(order)` turns the status staff (and the GSM webhook) set on an order, plus its STATUS_CHANGED events, into the "My order" progress bar. Each step is `done`, `current` (the order is in it right now), `upcoming`, `attention` (needs a change) or `stopped` (the order ended there), with `at` = when it was first reached.

| Step | Reached when | Time |
|---|---|---|
| Bestilling mottatt | order placed | `createdAt` |
| Under behandling | automatically — the order is in the dashboard (`processing`) | `createdAt` |
| Bekreftet | `approved` / `confirmed` | first event to either |
| På vei | `active` (GSM sets it when a driver accepts / is in transit) | first event to it |
| Fullført | `completed` / `invoiced` / `paid` | first event to one of them |

`current` is used for Under behandling and På vei. A normal order shows where it is **now** (staff can move it back). A step passed without its own status change has no time.

**Stopped and flagged orders** (`note` tells the page what to explain under the bar):

- `rejected`: Under behandling becomes an orange "Trenger endring" step (`attention`); the rest stay upcoming. `note: "needsChange"`.
- `cancelled`: how far the order got is judged from the events before the (latest) cancellation. Before På vei, a red "Kansellert" step follows the last step it reached and nothing comes after it. Once on its way, it ends with "Ikke gjennomført" in Fullført's place. No history = cancelled in review. `note: "cancelled"` / `"notCompleted"`.
- `failed`: always on its way, then "Ikke gjennomført". `note: "notCompleted"`.

`listCustomerOrders` and `customerOrderView` (`customerOrderView.ts`) read the order's STATUS_CHANGED events and add `progress` to each order.
