"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { heightHoldAction, nextRevealedCount, progressPercent, retractedRevealedCount } from "./steppedModalLogic";

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

// Animates a freshly-revealed section in: height grows from 0 and the
// content fades from 0% to 100% opacity, instead of snapping into place.
// Exported so other reveal-on-mount cases (e.g. a product card added to a
// list) can reuse the same animation instead of a second implementation.
export function RevealSection({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // overflow-hidden is only needed while the height animates. Left on, it
  // becomes the scroll container for any `position: sticky` descendant (e.g.
  // the order summary), pinning it in place instead of following the scroll.
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    // Double RAF: first frame commits the closed (0fr/opacity-0) render,
    // second frame has layout, so the transition to open actually animates
    // instead of starting already at its end state.
    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => setIsOpen(true));
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && isOpen) setIsSettled(true);
      }}
    >
      <div className={isSettled ? "" : "overflow-hidden"}>{children}</div>
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
  const structureKey = `${showFinalStep ? "final" : "steps"}:${visibleSections.map((section) => section.id).join("|")}`;
  const previousStructureKey = useRef(structureKey);
  const previousRevealedCount = useRef(revealedCount);
  useLayoutEffect(() => {
    const retracting = revealedCount < previousRevealedCount.current;
    previousRevealedCount.current = revealedCount;
    if (previousStructureKey.current === structureKey) return;
    previousStructureKey.current = structureKey;
    const el = contentRef.current;
    if (!el || lastHeightRef.current === 0) return;
    const action = heightHoldAction({ retracting, holdPending: holdPendingRef.current });
    if (action === "keep-holding") return;
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
    // A retracted section is gone at once, so shrink right away. A newly added
    // section starts collapsed and animates open, so keep holding the old
    // height until it has.
    if (action === "release-now") {
      holdPendingRef.current = false;
      release();
    } else {
      holdPendingRef.current = true;
      holdTimerRef.current = window.setTimeout(() => {
        holdPendingRef.current = false;
        release();
      }, 450);
    }
  }, [structureKey, revealedCount]);
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
          <div className={showFinalStep ? "hidden" : "flex flex-col gap-6"}>
            {visibleSections.map((section, index) => (
              <RevealSection key={section.id}>
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
              </RevealSection>
            ))}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
