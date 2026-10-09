import type { OrderProgress, OrderProgressStepState } from "@/lib/customerAccounts/orderProgress";
import { CheckIcon, CrossIcon } from "./myOrderIcons";
import { PROGRESS_NOTES, STEP_LABELS, formatStepTime } from "./orderProgressText";

type Props = { progress: OrderProgress; locale: "no" | "en" };

const LINE_INTO: Record<OrderProgressStepState, string> = {
  done: "bg-logoblue",
  current: "bg-logoblue",
  attention: "bg-orange-400",
  stopped: "bg-red-500",
  upcoming: "bg-gray-200",
};

const LABEL_CLASS: Record<OrderProgressStepState, string> = {
  done: "font-medium text-gray-900",
  current: "font-semibold text-logoblue",
  attention: "font-semibold text-orange-700",
  stopped: "font-semibold text-red-700",
  upcoming: "text-textColorThird",
};

function StepIcon({ state }: { state: OrderProgressStepState }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-logoblue text-white">
        <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-logoblue bg-white ring-4 ring-logoblue/15">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-logoblue" />
      </span>
    );
  }
  if (state === "attention") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-orange-500 bg-white text-sm font-bold text-orange-600 ring-4 ring-orange-100">
        !
      </span>
    );
  }
  if (state === "stopped") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
        <CrossIcon className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  return <span className="h-6 w-6 rounded-full border-2 border-gray-300 bg-white" />;
}

// The order's steps (lib/customerAccounts/orderProgress.ts) as a progress
// bar — horizontal from sm up (each step a fifth of the width, so a stopped
// order's bar ends where it stopped), a vertical list on phones.
export default function OrderProgressBar({ progress, locale }: Props) {
  const steps = progress.steps;
  const note = progress.note ? PROGRESS_NOTES[progress.note][locale] : null;

  return (
    <div>
      <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0">
        {steps.map((step, i) => {
          const next = steps[i + 1];
          return (
            <li key={step.key} className="relative flex items-start gap-3 sm:basis-1/5 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
              {next && (
                <span
                  aria-hidden
                  className={`absolute left-2.75 top-6 h-[calc(100%-8px)] w-0.5 sm:left-[calc(50%+14px)] sm:top-2.75 sm:h-0.5 sm:w-[calc(100%-28px)] ${LINE_INTO[next.state]}`}
                />
              )}
              <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
                <StepIcon state={step.state} />
              </span>
              <span className="flex flex-col text-sm leading-snug">
                <span className={LABEL_CLASS[step.state]}>{STEP_LABELS[step.key][locale]}</span>
                {step.at && <span className="text-xs text-textColorThird">{formatStepTime(step.at, locale)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {note && (
        <p
          className={`mt-5 rounded-xl px-4 py-3 text-sm ${
            progress.note === "needsChange" ? "bg-orange-50 text-orange-800" : "bg-red-50 text-red-800"
          }`}
        >
          {note}
        </p>
      )}
    </div>
  );
}
