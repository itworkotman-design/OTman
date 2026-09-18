"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { nextRevealedCount, progressPercent, retractedRevealedCount } from "./steppedModalLogic";

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
    <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

export function SteppedModal({ sections, finalStep, onClose }: SteppedModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [revealedCount, setRevealedCount] = useState(1);
  const [showFinalStep, setShowFinalStep] = useState(false);
  const visibleSections = sections.slice(0, revealedCount);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091030]/45 px-4 py-6 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-[864] flex-col overflow-hidden rounded-[32] bg-white shadow-[0_32px_100px_rgba(9,16,48,0.28)]">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
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
  );
}
