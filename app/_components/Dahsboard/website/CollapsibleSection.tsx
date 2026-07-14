// app/_components/Dahsboard/website/CollapsibleSection.tsx
"use client";

import { useState } from "react";

type Props = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export default function CollapsibleSection({
  title,
  description,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
  children,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(Boolean(defaultOpen));
  const open = controlledOpen ?? internalOpen;

  function toggle() {
    const next = !open;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className="rounded-lg border border-linePrimary bg-white">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <div className="font-semibold text-textcolor">{title}</div>
          {description ? <div className="text-xs text-textColorSecond">{description}</div> : null}
        </div>
        <span className="text-textColorSecond">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="flex flex-col gap-4 border-t border-linePrimary p-4">{children}</div> : null}
    </div>
  );
}
