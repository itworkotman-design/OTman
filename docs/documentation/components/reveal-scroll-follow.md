# app/_components/site/BookingModal/revealScrollFollow.ts

`followRevealedSection(deps)` scrolls a just-opened step into view, then keeps scrolling it into view whenever it grows, for `REVEAL_FOLLOW_MS` (2.5 s). This catches content that arrives after the step opened. It stops early when cancelled: the user scrolls, swipes or presses a key, the next step opens, or the modal closes. `SteppedModal` passes in the DOM parts (measure, scroll, a ResizeObserver, timers).
