# Stepped Modal

## Source

- `app/_components/site/BookingModal/SteppedModal.tsx`

## Responsibility

The homepage booking modal shell. Sections reveal one after another as each completes, with a progress bar, and the final step (a review page) replaces the body. `RevealSection` and `AnimatedStack` animate content in and out.

## Props

- `sections`, `finalStep`, `onClose` — the normal step-by-step flow.
- `showAll` — every section open at once, completion callbacks ignored, no final step and no progress fill. Used by the booking flow's admin mode.
- `title` — shown next to the logo (e.g. "Editing order #…").
- `footer` — pinned below the scrolling body (e.g. the admin save bar).
