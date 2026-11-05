import { newSectionScrollTop } from "./steppedModalLogic";

// How long a just-opened section keeps being followed. Its content can arrive
// after it opened (the website catalog loads from the server, slower on a
// hosted deploy than on localhost): while it shows "Laster…" it fits on
// screen, so the first scroll does nothing, and the products then appear
// below the fold. Following it a little longer scrolls them into view.
export const REVEAL_FOLLOW_MS = 2500;

type Measure = { scrollTop: number; viewportHeight: number; sectionTop: number; sectionBottom: number };

// Scrolls a just-revealed section into view now and again whenever it grows,
// until REVEAL_FOLLOW_MS has passed or the returned cancel is called (the user
// scrolled themselves, the next section opened, the modal closed). The DOM
// parts are passed in (SteppedModal), so this is testable on its own.
export function followRevealedSection(deps: {
  measure: () => Measure | null;
  scrollTo: (top: number) => void;
  observe: (onResize: () => void) => () => void;
  setTimer: (callback: () => void, ms: number) => () => void;
  padding: number;
}): () => void {
  let active = true;
  const scroll = () => {
    if (!active) return;
    const measured = deps.measure();
    if (!measured) return;
    const target = newSectionScrollTop({ ...measured, padding: deps.padding });
    if (target !== null) deps.scrollTo(target);
  };
  scroll();
  const disconnect = deps.observe(scroll);
  let cancelTimer: () => void = () => {};
  const stop = () => {
    if (!active) return;
    active = false;
    disconnect();
    cancelTimer();
  };
  cancelTimer = deps.setTimer(stop, REVEAL_FOLLOW_MS);
  return stop;
}
