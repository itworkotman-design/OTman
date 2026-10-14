# Stepped Modal

## Source

- `app/_components/site/BookingModal/SteppedModal.tsx`

## Responsibility

The homepage booking modal shell. Sections reveal one after another as each completes, with a progress bar, and the final step (a review page) replaces the body. `RevealSection` and `AnimatedStack` animate content in and out.

## Props

- `sections`, `finalStep`, `onClose` — the normal step-by-step flow.
- `showAll` — every section open at once, completion callbacks ignored and no progress fill. The final step only shows while `finalStepOpen` is set, and its back action calls `onFinalStepBack` (`isFinalStepShown` in `steppedModalLogic.ts`). Used by the booking flow's customer edit mode ("My order"), which opens the summary from its edit bar.
- `title` — shown next to the logo (e.g. "Editing order #…").
- `footer` — pinned below the scrolling body (e.g. the admin save bar).

## Shared side column (`aside`)
Optional `aside={{ node, fromId, untilId }}`: the revealed sections from `fromId` up to, not including,
`untilId` render in a `lg:grid-cols-[1fr_400px]` row beside one sticky `node` (stacked under them on small
screens); sections before and after stay full width. Grouping is `asideSectionGroups`
(`steppedModalLogic.ts`, tested). The moving flow uses it for its one calculator, from "moving-from" until
"your-details".
