# `app/_components/site/BookingModal/AutoAdvance.tsx`

## Purpose
Shared by every `SteppedModal` flow (white goods/furniture, moving). Renders
nothing; reveals the next section the moment a section's required fields are
all answered, so sections need no "Continue" button — and retracts the
sections after it if an answer is cleared again.

## Functions
### `AutoAdvance({ ready, hold, onReady, onRetract })`
`onReady`/`onRetract` are the section's `onComplete`/`onUncomplete`. Fires only
on `ready` transitions. While `hold` is true an unready section leaves later
sections alone; `hold` dropping while still unready retracts them.
