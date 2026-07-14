// app/_components/Dahsboard/website/TagInput.tsx
"use client";

import { useState } from "react";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  label?: string;
};

const MAX_TAGS = 20;

export default function TagInput({ value, onChange, suggestions = [], label }: Props) {
  const [draft, setDraft] = useState("");

  function addTag(rawName: string) {
    const name = rawName.trim();
    if (!name || value.length >= MAX_TAGS) return;
    if (value.some((tag) => tag.toLowerCase() === name.toLowerCase())) return;
    onChange([...value, name]);
  }

  function removeTag(name: string) {
    onChange(value.filter((tag) => tag !== name));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
      setDraft("");
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-sm font-semibold text-textcolor">{label}</span> : null}

      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-linePrimary/30 px-3 py-1 text-xs font-semibold text-textcolor"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => removeTag(tag)}
              className="text-textColorSecond hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <input
        list="blog-tag-suggestions"
        className="customInput font-normal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) {
            addTag(draft);
            setDraft("");
          }
        }}
        placeholder="Type a tag and press Enter"
        disabled={value.length >= MAX_TAGS}
      />
      <datalist id="blog-tag-suggestions">
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
