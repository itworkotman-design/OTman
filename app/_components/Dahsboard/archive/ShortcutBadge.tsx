// Small OS-shortcut-style corner arrow — marks a pill/row as a shortcut
// (see lib/docArchive/shortcuts.ts) rather than the real item. Shared by
// EntityPill's code-badge overlay, ShortcutItemView's breadcrumb, and
// FolderSettingsView's read-only shortcut placeholder row.
export function ShortcutBadge({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 6a1 1 0 0 0 0 2h6.586L5.293 17.293a1 1 0 1 0 1.414 1.414L16 9.414V16a1 1 0 1 0 2 0V7a1 1 0 0 0-1-1H8z" />
    </svg>
  );
}
