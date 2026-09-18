import type { SVGProps } from "react";

// Shared placeholder line icons used both on WhiteGoodsProductCard's
// section headers and on WhiteGoodsOrderSummary's per-line icons, so the
// two stay visually consistent without duplicating the markup.
type SectionIconProps = SVGProps<SVGSVGElement>;

export function TruckIcon(props: SectionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="7" width="12" height="9" rx="1" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </svg>
  );
}

export function WrenchIcon(props: SectionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.7 6.3a3 3 0 1 0-4.24 4.24L4 17l3 3 6.46-6.46a3 3 0 0 0 4.24-4.24l-1.5-1.5-1.5 1.5z" />
    </svg>
  );
}

export function GearIcon(props: SectionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

export function CalculatorIcon(props: SectionIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="7" y1="6" x2="17" y2="6" />
      <line x1="7" y1="11" x2="9" y2="11" />
      <line x1="11" y1="11" x2="13" y2="11" />
      <line x1="15" y1="11" x2="17" y2="11" />
      <line x1="7" y1="15" x2="9" y2="15" />
      <line x1="11" y1="15" x2="13" y2="15" />
      <line x1="15" y1="15" x2="17" y2="15" />
      <line x1="7" y1="19" x2="9" y2="19" />
      <line x1="11" y1="19" x2="17" y2="19" />
    </svg>
  );
}
