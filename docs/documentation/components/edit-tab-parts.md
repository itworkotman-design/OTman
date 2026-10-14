# `app/_components/Dahsboard/booking/websiteOrders/EditTabParts.tsx`

## Purpose
The dashboard-style pieces both "Edit order" tabs are built from (`WebsiteOrderEditTab`, `MovingOrderEditTab`).

## Components
- `CardHeading({ icon, title, summary, action? })` — top of a card: a round blue badge (number or icon), title, one-line summary.
- `ChoiceButton({ selected, onClick, wide?, children })` — a toggle for one of a few options.
- `TimeWindowChoice({ value, onChange, t, labelClass, fieldClass })` — the time window: presets, "Custom time" (any from/to,
  saved as `HH:MM-HH:MM`), and an older free-text window kept as its own option.
