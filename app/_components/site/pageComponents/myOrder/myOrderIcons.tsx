import { Base, type IconProps } from "@/app/_components/site/BookingModal/whiteGoods/iconBase";

// Line icons for the "My order" pages (order cards, progress bar, contact box).

export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Base>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Base>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Base>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.2v3.3h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6.5 12.5 3.5 3.5 7.5-8" />
    </Base>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </Base>
  );
}

export function DotsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="5.5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1" fill="currentColor" />
    </Base>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L4.5 19.5l1.2-3.6C4.3 14.6 3.5 12.9 3.5 11c0-3.9 3.8-7 8.5-7Z" />
    </Base>
  );
}
