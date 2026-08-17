// Single source of truth for the font-size choices offered anywhere in the
// blog/archive rich-text editing UI — both the per-character font-size mark
// (RichTextEditorField's own toolbar, via showFontSize) and the RICH_TEXT
// section's section-level font size (SectionTextStyleFields) draw from this
// same list, so the two can never drift out of sync with each other.
export const RICH_TEXT_FONT_SIZE_OPTIONS = [
  { value: "", labelEn: "Default", labelNb: "Standard" },
  { value: "14px", labelEn: "Small", labelNb: "Liten" },
  { value: "16px", labelEn: "Normal", labelNb: "Normal" },
  { value: "20px", labelEn: "Large", labelNb: "Stor" },
  { value: "28px", labelEn: "Extra large", labelNb: "Ekstra stor" },
] as const;
