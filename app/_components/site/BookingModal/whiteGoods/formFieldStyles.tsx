"use client";

import type { ReactNode } from "react";
import { QuestionMarkIcon } from "./orderDetailsIcons";

// Shared field styling for the "Order details"-style cards (OrderDetailsCard,
// PickupContactCard) so every plain text input in this part of the flow
// looks the same without each card redefining it.
export const inputClass =
  "h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-sm text-black/85 outline-none transition placeholder:text-black/35 focus:border-logoblue/40";

// Same field, but with a red border/ring — for a required field the visitor
// has left (blurred) while still empty.
export const inputErrorClass =
  "h-11 w-full rounded-xl border border-red-400 bg-white px-3.5 text-sm text-black/85 outline-none transition placeholder:text-black/35 ring-2 ring-red-100 focus:border-red-400";

export function fieldClass(hasError: boolean): string {
  return hasError ? inputErrorClass : inputClass;
}

// Small uppercase eyebrow label used above an address input — the input
// itself carries a leading pin icon, so the label needs none.
export function AddressLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-black/45">
      {children}
    </label>
  );
}

// The sentence-case label used above a field: a small icon, the text, and an
// optional "?" tooltip (native title attribute — this app has no tooltip
// component yet, and a hover title is enough for a one-line hint).
export function FieldLabel({
  icon,
  children,
  hint,
}: {
  icon: ReactNode;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-black/75">
      <span className="text-black/40">{icon}</span>
      {children}
      {hint && (
        <span
          title={hint}
          tabIndex={0}
          className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-black/30 hover:text-black/50"
        >
          <QuestionMarkIcon className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  );
}
