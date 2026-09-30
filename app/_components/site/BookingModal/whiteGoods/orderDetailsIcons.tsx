import { Base, type IconProps } from "./iconBase";

// Icon set for the "Order details" step's card header and field labels —
// kept local to this step since none of these (document, lift, calendar,
// clock, warning triangle, chevron stepper, tooltip "?") are reused
// elsewhere in the white goods flow.

export function DocumentIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </Base>
  );
}

export function LiftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="m10 9-2 2 2 2M14 9l2 2-2 2" />
    </Base>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="1.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Base>
  );
}

export function WarningTriangleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 2 20h20L12 3.5Z" />
      <path d="M12 10v4" />
      <path d="M12 17.2h.01" />
    </Base>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 14l6-6 6 6" />
    </Base>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 10l6 6 6-6" />
    </Base>
  );
}

export function QuestionMarkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 1.9" />
      <path d="M12 17.3h.01" />
    </Base>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6" />
    </Base>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 5 6.1 1.5 1.5 0 0 1 6.5 3.5Z" />
    </Base>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 6.5 8 6 8-6" />
    </Base>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5h16v11H8l-4 4V5Z" />
      <path d="M8 9h8M8 12.5h5" />
    </Base>
  );
}
