import BulletList from "@tiptap/extension-bullet-list";

export type BulletListVariant = "dot" | "dashed";

// Extends the standard bullet list node with a `variant` attribute so the
// toolbar can switch between a normal dot marker and a dashed marker,
// rendered as CSS classes (see .rich-text-list-dashed in globals.css).
// Ordered lists don't need this — they're configured with a fixed
// `list-decimal` class directly where the editor sets up its extensions.
export const StyledBulletList = BulletList.extend({
  addAttributes() {
    return {
      variant: {
        default: "dot" as BulletListVariant,
        parseHTML: (element) =>
          element.classList.contains("rich-text-list-dashed") ? "dashed" : "dot",
        renderHTML: (attributes) => ({
          class:
            attributes.variant === "dashed"
              ? "rich-text-list-dashed pl-5"
              : "list-disc pl-5",
        }),
      },
    };
  },
});
