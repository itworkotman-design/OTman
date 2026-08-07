"use client";

import type { ReactNode } from "react";
import { useReducer } from "react";

type PanelItem = {
  id: string;
  title: string;
  // Shown under the title inside the header row itself (e.g. a section's
  // own description), distinct from `subtitle` which renders on the right
  // alongside the expand/collapse chevron.
  description?: string;
  subtitle?: string;
  content?: ReactNode;
};

// "white" is this component's original look (white row, blue text/arrow) —
// used by the "Archive controls" accordion. "logoblue" matches the
// otman-archive prototype's ArchiveControlAccordion `variant="logoblue"`
// (solid blue row, white text/arrow, subtle white-tint hover) — used for the
// "Sections" accordion so sections read as a distinct, blue-headed
// drop-down rather than looking like another control row.
type PanelVariant = "white" | "logoblue";

type ExpandablePanelListProps = {
  items: PanelItem[];
  emptyMessage?: string;
  onToggle?: (id: string, expanded: boolean) => void;
  variant?: PanelVariant;
};

type ExpandedState = Record<string, boolean>;
type ExpandedAction = { type: "toggle"; id: string };

function expandedReducer(state: ExpandedState, action: ExpandedAction): ExpandedState {
  return { ...state, [action.id]: !state[action.id] };
}

const variantClasses: Record<PanelVariant, { row: string; title: string; description: string; subtitle: string }> = {
  white: { row: "bg-white", title: "text-logoblue", description: "text-textColorThird", subtitle: "text-textColorThird" },
  logoblue: { row: "bg-logoblue", title: "text-white", description: "text-white/80", subtitle: "text-white" },
};

export function ExpandablePanelList({ items, emptyMessage, onToggle, variant = "white" }: ExpandablePanelListProps) {
  const [expandedRows, dispatch] = useReducer(expandedReducer, {});
  const classes = variantClasses[variant];

  if (items.length === 0) {
    return emptyMessage ? (
      <div className="customContainer flex items-center justify-center py-8 text-sm text-textColorThird">{emptyMessage}</div>
    ) : null;
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => {
        const expanded = Boolean(expandedRows[item.id]);

        return (
          <div key={item.id} className="overflow-hidden rounded-xl border border-logoblue">
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "toggle", id: item.id });
                onToggle?.(item.id, !expanded);
              }}
              className={`flex w-full cursor-pointer items-center justify-between border-none px-6 py-4 text-left ${classes.row}`}
              aria-expanded={expanded}
            >
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span className={`text-[18px] font-bold ${classes.title}`}>{item.title}</span>
                {item.description && <span className={`text-[13px] font-normal ${classes.description}`}>{item.description}</span>}
              </span>
              <span className={`flex items-center gap-1 text-[13px] font-semibold ${classes.subtitle}`}>{item.subtitle}</span>
            </button>
            <div className={`grid bg-white transition-all duration-200 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="border-t border-lineSecondary px-6 py-5 text-textColorSecond">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
