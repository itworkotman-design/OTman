"use client";

import type { ReactNode } from "react";
import { useReducer } from "react";

type PanelItem = {
  id: string;
  title: string;
  subtitle?: string;
  content?: ReactNode;
};

type ExpandablePanelListProps = {
  items: PanelItem[];
  emptyMessage?: string;
  onToggle?: (id: string, expanded: boolean) => void;
};

type ExpandedState = Record<string, boolean>;
type ExpandedAction = { type: "toggle"; id: string };

function expandedReducer(state: ExpandedState, action: ExpandedAction): ExpandedState {
  return { ...state, [action.id]: !state[action.id] };
}

export function ExpandablePanelList({ items, emptyMessage, onToggle }: ExpandablePanelListProps) {
  const [expandedRows, dispatch] = useReducer(expandedReducer, {});

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
              className="flex w-full cursor-pointer items-center justify-between border-none bg-white px-6 py-4 text-left"
              aria-expanded={expanded}
            >
              <span className="text-[18px] font-bold text-logoblue">{item.title}</span>
              <span className="flex items-center gap-1 text-[13px] font-semibold text-textColorThird">
                {item.subtitle}
                <span className={`inline-block transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
              </span>
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
