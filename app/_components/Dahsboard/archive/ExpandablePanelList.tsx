"use client";

import type { ReactNode } from "react";
import { useReducer } from "react";

type PanelVariant = "white" | "logoblue";

type PanelItem = {
  id: string;
  title: string;
  columns: string[];
  content?: ReactNode;
};

type ExpandablePanelListProps = {
  items: PanelItem[];
  variant: PanelVariant;
  emptyMessage?: string;
};

type ExpandedState = Record<string, boolean>;
type ExpandedAction = { type: "toggle"; id: string };

const variantClasses: Record<
  PanelVariant,
  { row: string; primaryText: string; secondaryText: string; arrow: string; hover: string }
> = {
  white: {
    row: "bg-white",
    primaryText: "text-logoblue",
    secondaryText: "text-textColorThird",
    arrow: "text-logoblue",
    hover: "hover:bg-logoblue/5",
  },
  logoblue: {
    row: "bg-logoblue",
    primaryText: "text-white",
    secondaryText: "text-white",
    arrow: "text-white",
    hover: "hover:bg-white/10",
  },
};

function expandedReducer(state: ExpandedState, action: ExpandedAction): ExpandedState {
  return { ...state, [action.id]: !state[action.id] };
}

function ArrowIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-6 w-6 fill-current transition-transform ${expanded ? "rotate-180" : ""}`}>
      <path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" />
    </svg>
  );
}

export function ExpandablePanelList({ items, variant, emptyMessage }: ExpandablePanelListProps) {
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
          <div key={item.id} className="overflow-hidden rounded-xl border border-logoblue font-semibold">
            <button
              type="button"
              onClick={() => dispatch({ type: "toggle", id: item.id })}
              className={`flex w-full items-center text-left ${classes.row}`}
              aria-expanded={expanded}
            >
              <div className={`grow px-6 py-4 text-[1.25rem] ${classes.primaryText}`}>{item.title}</div>
              {item.columns.map((column) => (
                <div key={column} className={`w-[180] shrink-0 px-4 py-4 text-center text-sm ${classes.secondaryText}`}>
                  {column}
                </div>
              ))}
              <div className={`mr-4 rounded-full p-2 transition-colors ${classes.arrow} ${classes.hover}`}>
                <ArrowIcon expanded={expanded} />
              </div>
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
