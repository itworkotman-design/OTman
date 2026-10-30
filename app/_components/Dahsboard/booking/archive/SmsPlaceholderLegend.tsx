"use client";

export type SmsPlaceholder = { key: string; label: string };

// Clickable {placeholder} chips shared by every SMS text box (templates in
// Settings, the order's SMS tab, bulk Send SMS). Hovering shows what each one
// is filled in with.
export function SmsPlaceholderLegend({ placeholders, onInsert }: { placeholders: readonly SmsPlaceholder[]; onInsert?: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {placeholders.map((placeholder) => (
        <button
          key={placeholder.key}
          type="button"
          title={placeholder.label}
          onClick={() => onInsert?.(`{${placeholder.key}}`)}
          className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-logoblue hover:bg-slate-200"
        >
          {`{${placeholder.key}}`}
        </button>
      ))}
    </div>
  );
}
