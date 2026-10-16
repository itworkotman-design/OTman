import type { ServiceIconKey } from "@/lib/content/serviceRequestCatalog";
import { Base, type IconProps } from "../whiteGoods/iconBase";

// Line icons for the services modal's service tiles, one per
// ServiceIconKey (lib/content/serviceRequestCatalog.ts). Same 24x24 stroke
// style as the delivery modal's product icons (productIcons.tsx,
// furnitureIcons.tsx) — swap any entry once real artwork exists.

const ElectricianIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M13 2.5 5.5 13.5h6l-1 8 8-11.5h-6l.5-7.5z" />
  </Base>
);

const CarpenterIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M14.5 4.5 19.5 9.5" />
    <path d="M12 7l5 5-2 2-5-5z" />
    <path d="M10.5 10.5 3.5 17.5a1.4 1.4 0 0 0 2 2l7-7" />
    <path d="M14.5 4.5l1.5-1.5 3 3-1.5 1.5" />
  </Base>
);

const PlumberIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 8h8a3 3 0 0 1 3 3v3" />
    <path d="M3 5v6" />
    <path d="M11.5 14h5v3h-5z" />
    <path d="M14 17v1.5" />
    <path d="M14 20.5c-.8 0-1.3-.6-1.3-1.2 0-.8 1.3-2 1.3-2s1.3 1.2 1.3 2c0 .6-.5 1.2-1.3 1.2z" />
  </Base>
);

const GardenIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 21v-9" />
    <path d="M12 12c0-4 2.5-7 7-7 0 4.5-3 7-7 7z" />
    <path d="M12 15c0-3-2-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5z" />
    <path d="M5 21h14" />
  </Base>
);

const CleaningIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M8 9h6v11.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" />
    <path d="M9 9V6.5h4V9" />
    <path d="M9 4h5.5l1.5 2" />
    <path d="M18.5 4.5v.01M20.5 6.5v.01M18.5 8.5v.01" strokeWidth={2} />
    <path d="M8 14h6" />
  </Base>
);

const ItIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M9 20h6M12 16v4" />
    <path d="m10 8.5-2 1.5 2 1.5M14 8.5l2 1.5-2 1.5" />
  </Base>
);

const CustomIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Base>
);

const ICONS: Record<ServiceIconKey, (props: IconProps) => React.JSX.Element> = {
  electrician: ElectricianIcon,
  carpenter: CarpenterIcon,
  plumber: PlumberIcon,
  garden: GardenIcon,
  cleaning: CleaningIcon,
  it: ItIcon,
  custom: CustomIcon,
};

export function ServiceIcon({ iconKey, ...props }: IconProps & { iconKey: ServiceIconKey }) {
  const Icon = ICONS[iconKey];
  return <Icon {...props} />;
}
