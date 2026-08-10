"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";
import { StyledBulletList } from "@/lib/blog/tiptapListStyles";
import { FontSize } from "@/lib/blog/tiptapFontSize";
import { NonExtendingLink } from "@/lib/blog/tiptapLinkExtension";

type ListMode = "none" | "bullet" | "full";

type Props = {
  value: string;
  onChange: (html: string) => void;
  // Toolbar labels are English-only when omitted (the Blog admin's own
  // long-standing behavior — that dashboard has no nb toggle). Archive's
  // callers pass their page's locale for the handful of translated labels.
  locale?: string;
  showItalic?: boolean;
  showUnderline?: boolean;
  showLink?: boolean;
  // The extra per-link color/underline sub-fields in the link panel — Blog
  // only. Archive's link button just sets a bare URL.
  linkAdvanced?: boolean;
  listMode?: ListMode;
  showFontSize?: boolean;
  // "lg" is Archive Title's large-heading look (its one caller); every
  // other caller uses the normal body-text size.
  size?: "sm" | "lg";
  // By default the typing surface stays plain (color/font-size formatting
  // only shows up once saved and viewed elsewhere) so a long colored
  // paragraph doesn't fight readability while composing it — see the
  // `.rich-text-editor-surface` override in globals.css. Title is one short
  // heading line with no separate saved-preview state to check color
  // against (unlike Text fields, which shows a read-only preview of each
  // staged/saved field alongside its own edit form), so per explicit
  // request it opts out and shows applied color live instead.
  livePreview?: boolean;
};

const FONT_SIZE_OPTIONS = [
  { value: "", labelEn: "Default", labelNb: "Standard" },
  { value: "14px", labelEn: "Small", labelNb: "Liten" },
  { value: "16px", labelEn: "Normal", labelNb: "Normal" },
  { value: "20px", labelEn: "Large", labelNb: "Stor" },
  { value: "28px", labelEn: "Extra large", labelNb: "Ekstra stor" },
];

const LIST_OPTIONS = [
  { value: "none", labelEn: "No list", labelNb: "Ingen liste" },
  { value: "ordered", labelEn: "Numbered list", labelNb: "Nummerert liste" },
  { value: "dot", labelEn: "Bullet list", labelNb: "Punktliste" },
  { value: "dashed", labelEn: "Dashed list", labelNb: "Strekliste" },
];

const DEFAULT_LINK_COLOR = "#273097";

// Quick-pick swatches next to the color picker — the two colors already
// used everywhere else in this UI (--logoblue, --textColorSecond in
// globals.css), so text formatted with them matches the rest of the app
// instead of needing the native picker + a remembered hex value every time.
const RECENT_COLORS = [
  { value: "#273097", labelEn: "Logo blue", labelNb: "Logoblå" },
  { value: "#5c5c5c", labelEn: "Text secondary", labelNb: "Tekst sekundær" },
];

// The three horizontal "lines of text" alignment glyphs — the widely
// recognized paragraph-alignment icon set (Word/Docs/etc.), rather than a
// bare "L"/"C"/"R" letter, so the alignment is visually obvious at a glance.
function AlignLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="2.5" width="14" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="1" y="7.2" width="9" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="1" y="11.9" width="12" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}
function AlignCenterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="2.5" width="14" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="3.5" y="7.2" width="9" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2" y="11.9" width="12" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}
function AlignRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="2.5" width="14" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="6" y="7.2" width="9" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="3" y="11.9" width="12" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}

// Square, shadowless, separated only by a thin shared border — replaces the
// old pill-shaped `customButtonDefault` toolbar buttons per explicit
// request. `divide-x` on the wrapping row (see ToolbarGroup below) supplies
// the "small very light border separating them"; this button itself carries
// no border of its own.
function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold transition-colors disabled:cursor-auto disabled:opacity-40 ${
        active ? "bg-linePrimary text-logoblue" : "text-textColorSecond hover:bg-linePrimary/70 hover:text-logoblue"
      }`}
    >
      {children}
    </button>
  );
}

// One light-bordered, divided row — every toolbar control (buttons, the
// list/font-size selects, the color swatch) sits inside this same row so
// the whole toolbar reads as one consistent set of square, shadowless
// controls separated by a single hairline rather than a loose row of
// individually-boxed pills.
function ToolbarGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-stretch divide-x divide-linePrimary overflow-hidden rounded-md border border-linePrimary">
      {children}
    </div>
  );
}

type LinkPanelState = {
  range: { from: number; to: number };
  hadLink: boolean;
  url: string;
  color?: string;
  underline?: boolean;
};

// The single rich-text editor shell shared by Blog (website/*) and Archive
// (Dahsboard/archive/*) — previously three separate, slowly-diverging
// copies (website/RichTextEditorField.tsx, ArchiveRichTextEditorField.tsx,
// TitleRichTextEditorField.tsx). Feature flags below reproduce each of
// those three's exact previous toolbar scope (Blog: everything; Archive
// text fields: no italic/underline, bullet-only list, plain link; Archive
// title: bold/italic/align/color only, no link/list/font-size) so this is a
// pure consolidation, not a feature change to any existing caller — but any
// future toolbar/UI tweak (like this one) now only has to happen once.
export function RichTextEditorField({
  value,
  onChange,
  locale,
  showItalic = false,
  showUnderline = false,
  showLink = false,
  linkAdvanced = false,
  listMode = "none",
  showFontSize = false,
  size = "sm",
  livePreview = false,
}: Props) {
  const nb = locale === "nb";
  const [linkPanel, setLinkPanel] = useState<LinkPanelState | null>(null);

  function openLinkPanelForCurrentSelection() {
    if (!editor) return;

    if (editor.isActive("link")) {
      editor.chain().extendMarkRange("link").run();
    }

    const { from, to } = editor.state.selection;
    if (from === to) return;

    const linkAttrs = editor.getAttributes("link");
    const next: LinkPanelState = { range: { from, to }, hadLink: Boolean(linkAttrs.href), url: linkAttrs.href ?? "" };
    if (linkAdvanced) {
      const colorAttrs = editor.getAttributes("textStyle");
      next.color = /^#[0-9a-fA-F]{6}$/.test(colorAttrs.color) ? colorAttrs.color : DEFAULT_LINK_COLOR;
      next.underline = editor.isActive("underline");
    }
    setLinkPanel(next);
  }

  function applyLinkPanel() {
    if (!editor || !linkPanel) return;

    const url = linkPanel.url.trim();
    const chain = editor.chain().focus().setTextSelection(linkPanel.range);

    if (url === "") {
      chain.extendMarkRange("link").unsetLink();
    } else {
      const normalizedUrl = /^(https?:\/\/|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}`;
      chain.extendMarkRange("link").setLink({ href: normalizedUrl });
    }

    if (linkAdvanced) {
      if (linkPanel.underline) chain.setUnderline();
      else chain.unsetUnderline();
      if (linkPanel.color) chain.setColor(linkPanel.color);
      chain.setTextSelection(linkPanel.range.to).unsetColor().unsetUnderline();
    } else {
      chain.setTextSelection(linkPanel.range.to);
    }

    chain.run();
    setLinkPanel(null);
  }

  function removeLinkFromPanel() {
    if (!editor || !linkPanel) return;
    const chain = editor
      .chain()
      .focus()
      .setTextSelection(linkPanel.range)
      .extendMarkRange("link")
      .unsetLink()
      .setTextSelection(linkPanel.range.to);
    if (linkAdvanced) chain.unsetColor().unsetUnderline();
    chain.run();
    setLinkPanel(null);
  }

  // Shared by the native color picker and the recent-color swatches below.
  function applyColor(color: string) {
    if (!editor || editor.isActive("link")) return;
    if (editor.state.selection.empty) {
      editor.chain().focus().selectAll().setColor(color).run();
    } else {
      editor.chain().focus().setColor(color).run();
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false, link: false, underline: false }),
      ...(listMode !== "none" ? [StyledBulletList] : []),
      ...(showUnderline ? [Underline] : []),
      TextAlign.configure({ types: ["paragraph"] }),
      ...(showLink ? [NonExtendingLink.configure({ openOnClick: false, autolink: false })] : []),
      TextStyle,
      Color,
      ...(showFontSize ? [FontSize] : []),
    ],
    content: value,
    immediatelyRender: false,
    // Always an object — tiptap's EditorView setup reads properties off
    // `editorProps` unconditionally internally, so passing `undefined` here
    // (e.g. when `showLink` is false) crashes with "editorProps is
    // undefined" the moment the editor mounts.
    editorProps: {
      handleClick: !showLink
        ? undefined
        : (view, pos, event) => {
            const linkType = view.state.schema.marks.link;
            if (!linkType) return false;

            const mark = view.state.doc.resolve(pos).marks().find((m) => m.type === linkType);
            if (!mark) return false;

            event.preventDefault();
            editor?.chain().setTextSelection(pos).extendMarkRange("link").run();
            const { from, to } = editor?.state.selection ?? { from: pos, to: pos };
            const next: LinkPanelState = { range: { from, to }, hadLink: true, url: (mark.attrs.href as string) ?? "" };
            if (linkAdvanced) {
              const colorAttrs = editor?.getAttributes("textStyle") ?? {};
              next.color = /^#[0-9a-fA-F]{6}$/.test(colorAttrs.color) ? colorAttrs.color : DEFAULT_LINK_COLOR;
              next.underline = editor?.isActive("underline") ?? false;
            }
            setLinkPanel(next);
            return true;
          },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(sanitizeBlogHtml(instance.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const listValue =
    listMode === "full"
      ? editor.isActive("orderedList")
        ? "ordered"
        : editor.isActive("bulletList")
          ? editor.getAttributes("bulletList").variant === "dashed"
            ? "dashed"
            : "dot"
          : "none"
      : "none";

  function applyListStyle(nextValue: string) {
    if (!editor) return;

    if (nextValue === "none") {
      if (editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run();
      if (editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
      return;
    }

    if (nextValue === "ordered") {
      if (editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
      if (!editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run();
      return;
    }

    // "dot" or "dashed" — both are bulletList with a different variant attribute
    if (editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run();
    if (!editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
    editor.chain().focus().updateAttributes("bulletList", { variant: nextValue }).run();
  }

  const fontSizeValue = editor.getAttributes("textStyle").fontSize ?? "";
  const colorValue = editor.getAttributes("textStyle").color ?? "#000000";
  const charCount = editor.getText().length;

  return (
    <div className="rounded-md border border-linePrimary">
      <div className="flex flex-wrap items-center gap-2 border-b border-lineSecondary p-2">
        <ToolbarGroup>
          <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            B
          </ToolbarButton>
          {showItalic && (
            <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <span className="italic">I</span>
            </ToolbarButton>
          )}
          {showUnderline && (
            <ToolbarButton
              label="Underline"
              active={editor.isActive("underline")}
              disabled={editor.isActive("link")}
              onClick={() => {
                // Underline for linked text is controlled only via the link
                // panel's own checkbox, so it stays tied to the link's
                // styling rather than being toggled independently here.
                if (editor.isActive("link")) return;
                editor.chain().focus().toggleUnderline().run();
              }}
            >
              <span className="underline">U</span>
            </ToolbarButton>
          )}
          {showLink && (
            <ToolbarButton label="Link" active={editor.isActive("link")} onClick={openLinkPanelForCurrentSelection}>
              🔗
            </ToolbarButton>
          )}
          <ToolbarButton
            label="Align left"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Align center"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Align right"
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRightIcon />
          </ToolbarButton>
          {listMode === "bullet" && (
            <ToolbarButton
              label={nb ? "Punktliste" : "Bullet list"}
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              •≡
            </ToolbarButton>
          )}
          {listMode === "full" && (
            <select
              aria-label="List style"
              className="h-8 border-0 bg-transparent px-2 text-xs font-normal text-textColorSecond outline-none"
              value={listValue}
              onChange={(e) => applyListStyle(e.target.value)}
            >
              {LIST_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {nb ? option.labelNb : option.labelEn}
                </option>
              ))}
            </select>
          )}
          {showFontSize && (
            <select
              aria-label="Font size"
              className="h-8 border-0 bg-transparent px-2 text-xs font-normal text-textColorSecond outline-none"
              value={fontSizeValue}
              onChange={(e) => {
                if (e.target.value) editor.chain().focus().setFontSize(e.target.value).run();
                else editor.chain().focus().unsetFontSize().run();
              }}
            >
              {FONT_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {nb ? option.labelNb : option.labelEn}
                </option>
              ))}
            </select>
          )}
          <div className="flex h-8 items-center gap-1 px-2 text-xs text-textColorSecond">
            <span>{nb ? "Nylige" : "Recent"}</span>
            {RECENT_COLORS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-label={nb ? preset.labelNb : preset.labelEn}
                title={nb ? preset.labelNb : preset.labelEn}
                disabled={editor.isActive("link")}
                className="h-5 w-5 shrink-0 rounded-sm border border-linePrimary disabled:cursor-auto disabled:opacity-60"
                style={{ backgroundColor: preset.value }}
                onClick={() => applyColor(preset.value)}
              />
            ))}
          </div>
          <label className="flex h-8 items-center gap-1 px-2 text-xs text-textColorSecond">
            {nb ? "Farge" : "Color"}
            <input
              aria-label="Text color"
              type="color"
              disabled={editor.isActive("link")}
              className="h-5 w-6 cursor-pointer rounded-sm border border-linePrimary disabled:cursor-auto disabled:opacity-60"
              value={/^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue : "#000000"}
              onChange={(e) => applyColor(e.target.value)}
            />
          </label>
          <ToolbarButton
            label={nb ? "Nullstill farge" : "Reset color"}
            disabled={editor.isActive("link")}
            onClick={() => {
              if (editor.isActive("link")) return;
              if (editor.state.selection.empty) {
                editor.chain().focus().selectAll().unsetColor().run();
              } else {
                editor.chain().focus().unsetColor().run();
              }
            }}
          >
            ⌫
          </ToolbarButton>
        </ToolbarGroup>
      </div>

      {linkPanel ? (
        <div className="flex flex-col gap-3 border-b border-lineSecondary bg-linePrimary/10 p-3">
          <label className="flex flex-col gap-1 text-xs text-textColorSecond">
            {nb ? "Lenke-URL" : "Link URL"}
            <input
              autoFocus
              className="customInput font-normal"
              value={linkPanel.url}
              onChange={(e) => setLinkPanel({ ...linkPanel, url: e.target.value })}
              placeholder="google.com or /page"
            />
          </label>

          {linkAdvanced && (
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1 text-xs text-textColorSecond">
                {nb ? "Farge" : "Color"}
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border border-linePrimary"
                  value={linkPanel.color ?? DEFAULT_LINK_COLOR}
                  onChange={(e) => setLinkPanel({ ...linkPanel, color: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-textColorSecond">
                <input
                  type="checkbox"
                  checked={linkPanel.underline ?? false}
                  onChange={(e) => setLinkPanel({ ...linkPanel, underline: e.target.checked })}
                />
                {nb ? "Understrek" : "Underline"}
              </label>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" className="customButtonEnabled !px-3 !py-1 text-xs" onClick={applyLinkPanel}>
              {nb ? "Bruk" : "Apply"}
            </button>
            {linkPanel.hadLink ? (
              <button type="button" className="customButtonDefault !px-3 !py-1 text-xs" onClick={removeLinkFromPanel}>
                {nb ? "Fjern lenke" : "Remove link"}
              </button>
            ) : null}
            <button type="button" className="customButtonDefault !px-3 !py-1 text-xs" onClick={() => setLinkPanel(null)}>
              {nb ? "Avbryt" : "Cancel"}
            </button>
          </div>
        </div>
      ) : null}

      <EditorContent
        editor={editor}
        className={`${livePreview ? "" : "rich-text-editor-surface "}prose max-w-none px-3 py-2 ${size === "lg" ? "text-xl font-semibold" : "text-sm"}`}
      />

      <div className="border-t border-linePrimary px-3 py-1 text-left text-xs text-textColorThird">
        {charCount} {nb ? "tegn" : "characters"}
      </div>
    </div>
  );
}
