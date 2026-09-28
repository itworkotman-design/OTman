"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { heightHoldAction, nextRevealedCount, progressPercent, retractedRevealedCount, shownSectionIds, structureGainedSections, withExitingItems, type SectionStructure } from "./steppedModalLogic";

export type StepSectionRenderProps = {
  // True for the one section currently being answered (the last one
  // revealed). Earlier, already-completed sections stay visible but are
  // not active.
  isActive: boolean;
  onComplete: () => void;
  // For sections whose completion is condition-driven rather than a one-off
  // button click (see AutoAdvance in WhiteGoodsBookingFlow): call this when
  // that condition stops being satisfied, to retract any sections revealed
  // after it (and back out of the final step, if it was reached).
  onUncomplete: () => void;
};

export type StepSection = {
  id: string;
  title: string;
  description?: string;
  // Takes the section off the screen while it stays mounted, so it still counts
  // as a step and its auto-advance keeps working (the steps after it depend on
  // that), e.g. an options step whose list has no products left.
  hidden?: boolean;
  render: (props: StepSectionRenderProps) => ReactNode;
};

export type FinalStepRenderProps = {
  onBack: () => void;
};

// The last step isn't a stacked section — it replaces the whole modal body
// with its own review/payment page. Reaching it fills the progress bar;
// leaving it requires the explicit back action (onBack), not a section
// completing further.
export type FinalStep = {
  render: (props: FinalStepRenderProps) => ReactNode;
};

type SteppedModalProps = {
  sections: StepSection[];
  finalStep: FinalStep;
  onClose: () => void;
};

const TRANSITION_MS = 300;

// Animates a section in and out: on mount its height grows from 0 and the
// content fades from 0% to 100% opacity instead of snapping into place, and
// while `collapsed` (hidden, or on its way out of a list) it shrinks and fades
// back the same way. Exported so other cases (e.g. a product card added to a
// list) can reuse the same animation instead of a second implementation.
//
// `spacing` (px) is the gap below the section. It lives inside the animated
// box, so it collapses with it instead of leaving a stray gap behind.
export function RevealSection({
  children,
  collapsed = false,
  spacing = 0,
}: {
  children: ReactNode;
  collapsed?: boolean;
  spacing?: number;
}) {
  const [isMounted, setIsMounted] = useState(false);
  // overflow-hidden is only needed while the height animates. Left on, it
  // becomes the scroll container for any `position: sticky` descendant (e.g.
  // the order summary), pinning it in place instead of following the scroll.
  const [isSettled, setIsSettled] = useState(false);
  const isOpen = isMounted && !collapsed;

  useEffect(() => {
    // Double RAF: first frame commits the closed (0fr/opacity-0) render,
    // second frame has layout, so the transition to open actually animates
    // instead of starting already at its end state.
    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => setIsMounted(true));
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}
      // A collapsed section is off screen but stays mounted; keep it out of the
      // tab order and away from pointer events until it opens again.
      inert={!isOpen}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) setIsSettled(isOpen);
      }}
    >
      <div className={isOpen && isSettled ? "" : "min-h-0 overflow-hidden"}>
        <div style={spacing ? { paddingBottom: spacing } : undefined}>{children}</div>
      </div>
    </div>
  );
}

export type AnimatedStackItem = { key: string; node: ReactNode; hidden?: boolean };

// A vertical stack whose items animate in when added, out when removed, and
// collapse/expand when hidden/un-hidden. A removed item is kept (as last
// rendered) for the length of its exit animation, then dropped.
export function AnimatedStack({ items, gap, className = "" }: { items: AnimatedStackItem[]; gap: number; className?: string }) {
  // What is rendered: the current items plus the ones still animating out.
  // Derived from the previous render's items while rendering (React's
  // "adjust state on prop change" pattern), so a removed item is never missing
  // from the DOM even for a frame.
  const [previousItems, setPreviousItems] = useState(items);
  const [displayed, setDisplayed] = useState(items);
  if (previousItems !== items) {
    setPreviousItems(items);
    setDisplayed(withExitingItems(displayed, items));
  }

  const currentKeys = new Set(items.map((item) => item.key));
  const exitTimers = useRef(new Map<string, number>());

  useEffect(() => {
    for (const key of currentKeys) {
      window.clearTimeout(exitTimers.current.get(key));
      exitTimers.current.delete(key);
    }
    for (const { key } of displayed) {
      if (currentKeys.has(key) || exitTimers.current.has(key)) continue;
      exitTimers.current.set(
        key,
        window.setTimeout(() => {
          exitTimers.current.delete(key);
          setDisplayed((shown) => shown.filter((item) => item.key !== key));
        }, TRANSITION_MS),
      );
    }
  });

  useEffect(() => {
    const timers = exitTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // The last item's spacing is cancelled out, so the stack has no trailing gap.
  return (
    <div className={className} style={{ marginBottom: -gap }}>
      {displayed.map((item) => (
        <RevealSection key={item.key} collapsed={!!item.hidden || !currentKeys.has(item.key)} spacing={gap}>
          {item.node}
        </RevealSection>
      ))}
    </div>
  );
}

export function SteppedModal({ sections, finalStep, onClose }: SteppedModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock page scroll while the modal is open so wheel/touch over the blurred
  // backdrop doesn't scroll the page behind it. Locks <html>, not <body>:
  // globals.css gives html its own `overflow-y: scroll`, which makes html the
  // scroller (body's overflow no longer propagates to the viewport). Its
  // `scrollbar-gutter: stable` keeps the layout from shifting when it locks.
  useEffect(() => {
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prevOverflow;
    };
  }, []);

  // Keeps the page from jumping when steps are swapped. Adding a category
  // replaces the step you just clicked in with a new, initially collapsed one,
  // so for a moment the content is shorter and the browser clamps the scroll
  // position upward. Whenever the set of visible steps changes, the content
  // height from just before the change is held as a min-height until the new
  // step has animated open. (Height comes from a ResizeObserver, i.e. the last
  // completed layout; the min-height is set before the browser lays out the
  // shorter content.)
  const contentRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef(0);
  const holdTimerRef = useRef<number | undefined>(undefined);
  // True from when a reveal starts holding the height until that hold is released.
  const holdPendingRef = useRef(false);
  const releaseTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      lastHeightRef.current = el.offsetHeight;
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(holdTimerRef.current);
      window.clearTimeout(releaseTimerRef.current);
    };
  }, []);

  const [revealedCount, setRevealedCount] = useState(1);
  const [showFinalStep, setShowFinalStep] = useState(false);
  const visibleSections = sections.slice(0, revealedCount);
  const shownIds = shownSectionIds(visibleSections);
  const structureKey = `${showFinalStep ? "final" : "steps"}:${shownIds.join("|")}`;
  const previousStructure = useRef<SectionStructure>({ ids: shownIds, showFinalStep });
  const previousStructureKey = useRef(structureKey);
  useLayoutEffect(() => {
    if (previousStructureKey.current === structureKey) return;
    previousStructureKey.current = structureKey;
    const next: SectionStructure = { ids: shownIds, showFinalStep };
    const gained = structureGainedSections(previousStructure.current, next);
    previousStructure.current = next;
    const el = contentRef.current;
    if (!el || lastHeightRef.current === 0) return;
    const action = heightHoldAction({ gained, holdPending: holdPendingRef.current });
    if (action !== "hold-then-release") return;
    el.style.transition = "none";
    el.style.minHeight = `${lastHeightRef.current}px`;
    window.clearTimeout(holdTimerRef.current);
    window.clearTimeout(releaseTimerRef.current);
    const release = () => {
      // Releasing the hold outright would snap the modal to its (possibly
      // much shorter) natural height, e.g. after a section with many items is
      // retracted. Measure the natural height and ease the min-height down.
      const held = el.offsetHeight;
      el.style.minHeight = "0px";
      const natural = el.offsetHeight;
      el.style.minHeight = `${held}px`;
      if (natural >= held) {
        el.style.minHeight = "";
        return;
      }
      void el.offsetHeight;
      el.style.transition = "min-height 300ms ease-in-out";
      el.style.minHeight = `${natural}px`;
      releaseTimerRef.current = window.setTimeout(() => {
        el.style.minHeight = "";
        el.style.transition = "";
      }, 320);
    };
    // A newly added section starts collapsed and animates open, so keep holding
    // the old height until it has.
    holdPendingRef.current = true;
    holdTimerRef.current = window.setTimeout(() => {
      holdPendingRef.current = false;
      release();
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);
  // +1 for the final review/payment step, so the bar only completes once
  // the user actually reaches it, not while the last question section is
  // still being answered.
  const fillPercent = showFinalStep ? 100 : progressPercent(revealedCount, sections.length + 1);

  const handleSectionComplete = (index: number) => {
    if (index === sections.length - 1) {
      setShowFinalStep(true);
      return;
    }
    setRevealedCount((count) => nextRevealedCount(count, index, sections.length));
  };

  const handleSectionUncomplete = (index: number) => {
    setShowFinalStep(false);
    setRevealedCount((count) => retractedRevealedCount(count, index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-[#091030]/45 px-4 py-6 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-[32] bg-white shadow-[0_32px_100px_rgba(9,16,48,0.28)]">
        <div className="flex shrink-0 items-center justify-between px-5 py-3 sm:px-8">
          <Image src="/Otman Logo Horizontal Blue.svg" width={116} height={50} alt="Logo" className="h-[34] w-auto" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="h-1 shrink-0 bg-logoblue/10">
          <div className="h-full bg-logoblue transition-[width] duration-300 ease-out" style={{ width: `${fillPercent}%` }} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">
          <div ref={contentRef}>
          {showFinalStep && finalStep.render({ onBack: () => setShowFinalStep(false) })}

          {/* Kept mounted (just hidden) rather than conditionally rendered,
              so RevealSection's per-section reveal state survives toggling
              the final step back and forth instead of replaying on remount. */}
          <div className={showFinalStep ? "hidden" : ""}>
            <AnimatedStack
              gap={24}
              className="flex flex-col"
              items={visibleSections.map((section, index) => ({
                key: section.id,
                hidden: section.hidden,
                node: (
                  <div>
                    <h4 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">{section.title}</h4>
                    {section.description && <p className="mt-1 text-center text-sm text-black/60">{section.description}</p>}
                    <div className="mt-4">
                      {section.render({
                        isActive: index === revealedCount - 1,
                        onComplete: () => handleSectionComplete(index),
                        onUncomplete: () => handleSectionUncomplete(index),
                      })}
                    </div>
                  </div>
                ),
              }))}
            />
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
