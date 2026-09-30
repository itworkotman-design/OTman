"use client";

// Shared button-tile row for a simple single-pick question — used by
// CustomerTypeStep (private/business) and PickupSourceStep (store/private
// individual/business). Kept generic over the option id's string union so
// each caller keeps its own typed set of choices.
export function TileSelectStep<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { id: T; label: string }[];
  // The tile stays visible (not active) once answered, keeping its
  // logoblue highlight instead of reverting to unselected.
  value: T | null;
  onPick: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(option.id)}
            className={[
              "flex w-48 flex-col items-center gap-1 rounded-2xl border px-4 py-5 text-center transition",
              selected
                ? "border-logoblue bg-logoblue/5"
                : "border-black/10 hover:-translate-y-0.5 hover:border-logoblue/40 hover:shadow-md",
            ].join(" ")}
          >
            <span className={["text-base font-semibold", selected ? "text-logoblue" : "text-black/80"].join(" ")}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
