// app/_components/Dahsboard/website/SectionTypeIcon.tsx
import type { BlogSectionTypeValue } from "@/lib/blog/blogSectionSchemas";

type Props = {
  type: BlogSectionTypeValue;
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

export default function SectionTypeIcon({ type, className }: Props) {
  const props = { ...SHARED_PROPS, className };

  switch (type) {
    case "RICH_TEXT":
      return (
        <svg {...props}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="13" y2="18" />
        </svg>
      );
    case "IMAGE":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <polyline points="21 15 15.5 10 5 20" />
        </svg>
      );
    case "IMAGE_TEXT":
      return (
        <svg {...props}>
          <rect x="2" y="5" width="9" height="14" rx="1.5" />
          <circle cx="5.3" cy="9" r="1.1" />
          <polyline points="11 14.5 7.8 11 2 16.5" />
          <line x1="14" y1="7" x2="22" y2="7" />
          <line x1="14" y1="12" x2="22" y2="12" />
          <line x1="14" y1="17" x2="18.5" y2="17" />
        </svg>
      );
    case "GALLERY":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="8" height="8" rx="1.2" />
          <rect x="13" y="3" width="8" height="8" rx="1.2" />
          <rect x="3" y="13" width="8" height="8" rx="1.2" />
          <rect x="13" y="13" width="8" height="8" rx="1.2" />
        </svg>
      );
    case "CAROUSEL":
      return (
        <svg {...props}>
          <rect x="6.5" y="4" width="11" height="16" rx="1.5" />
          <polyline points="3 9 1 12 3 15" />
          <polyline points="21 9 23 12 21 15" />
        </svg>
      );
    case "QUOTE":
      return (
        <svg {...props}>
          <path d="M9.5 8.5c-2.2 0-3.5 1.6-3.5 4v3h4V12H8.3c0-1.2.4-1.9 1.7-2V8.5Z" />
          <path d="M18 8.5c-2.2 0-3.5 1.6-3.5 4v3h4V12h-1.7c0-1.2.4-1.9 1.7-2V8.5Z" />
        </svg>
      );
    case "CTA":
      return (
        <svg {...props}>
          <rect x="2" y="7" width="13" height="8" rx="2" />
          <line x1="5.5" y1="11" x2="11.5" y2="11" />
          <path d="M14 14l7 6-2.2-6.8L21 11z" />
        </svg>
      );
    case "DIVIDER":
      return (
        <svg {...props}>
          <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="4 3" />
        </svg>
      );
    case "SPACER":
      return (
        <svg {...props}>
          <path d="M12 3v5M9 6l3-3 3 3" />
          <path d="M12 21v-5M9 18l3 3 3-3" />
        </svg>
      );
    default:
      return null;
  }
}
