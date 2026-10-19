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
`untilId` render in a `lg:grid-cols-[1fr_400px]` row beside one `node`, vertically centred in the part of that row visible on screen — a sticky box sized on scroll/resize (`--aside-viewport`: from the row top or the scroll area top, whichever is lower, to the scroll area bottom, capped at the row height), so mid-scroll it sits in the middle of the screen (stacked under them on small
screens); sections before and after stay full width. Grouping is `asideSectionGroups`
(`steppedModalLogic.ts`, tested). The moving flow uses it for its one calculator, from "moving-from-details" until
"your-details".

## Dimming answered sections (`dimCompleted`)
Opt-in (the moving, services and delivery/white-goods flows use it): every section except the **active** one and the
newest two revealed ones fades to 50% opacity (`isSectionDimmed` in `steppedModalLogic.ts`). Hover does not change it. The
active section (`activeSectionIndex`) is the one the user last clicked/focused into — until the reveal changes, so
answering a section hands "active" to the section it reveals. The newest two sections always stay lit (a preselected
option can complete a section the instant it appears), so going back to an earlier section shows at most three lit. Never applies with `showAll`;
the `aside` column is never dimmed.

## Scrolling to new sections (`scrollToNewSections`)
Opt-in (the moving flow uses it): once a section is revealed for the first time and has animated open, the body
smoothly scrolls down just enough to show it (`newSectionScrollTop` — never up, never past the section's top; instant
with `prefers-reduced-motion`). "First time" is past the furthest the flow has ever been revealed
(`revealsUnseenSection`, both in `steppedModalLogic.ts`, tested): going back, changing an answer that retracts the
later sections and re-revealing them leaves the view where it is. Never applies with `showAll`. Each section's
wrapper carries `data-step-section={id}` for the lookup.

A single section can instead ask for the same scroll **every** time it comes on screen with `StepSection.scrollOnReveal`
(`revealedSectionToScrollTo`): the white-goods flow sets it on an added category's "Choose products" step, so adding a
category, removing it ("not needed") and adding another still pans down to the new products.
