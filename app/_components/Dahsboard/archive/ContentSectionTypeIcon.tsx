import type { ArchiveContentSectionType } from "@prisma/client";

type Props = {
  type: ArchiveContentSectionType;
  className?: string;
};

const SHARED_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// Same small-icon-per-type approach as website/SectionTypeIcon.tsx.
export function ContentSectionTypeIcon({ type, className }: Props) {
  const props = { ...SHARED_PROPS, className };

  switch (type) {
    case "IMAGES":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <polyline points="21 15 15.5 10 5 20" />
        </svg>
      );
    case "FILES":
      return (
        <svg {...props}>
          <path d="M6 2.5h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
          <polyline points="14 2.5 14 6.5 18 6.5" />
        </svg>
      );
    case "TEXT_FIELDS":
      return (
        <svg {...props}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="13" y2="18" />
        </svg>
      );
    case "SPREADSHEET":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="9" y1="4" x2="9" y2="20" />
          <line x1="15" y1="4" x2="15" y2="20" />
        </svg>
      );
    default:
      return null;
  }
}
