import type { SVGProps } from "react";
import { resolveProductIconKey } from "./productIconKey";

// Placeholder line-icon set for the white-goods product grid, keyed the
// same way resolveProductIconKey derives keys from product codes. Simple
// geometric stand-ins — swap individual entries here (or point
// Product.iconKey at a new key) once real artwork exists, no other code
// needs to change.
type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

const DishwasherIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <line x1="4" y1="8" x2="20" y2="8" />
    <circle cx="14" cy="5.5" r="0.8" fill="currentColor" stroke="none" />
    <rect x="6" y="11" width="12" height="7" rx="1" />
  </Base>
);

const WashingMachineIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <circle cx="9" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="14" r="5" />
    <circle cx="12" cy="14" r="2.2" />
  </Base>
);

const TumbleDryerIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <circle cx="8" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="11" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="14" cy="6" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="14" r="5" />
    <path d="M9.5 14a2.5 2.5 0 0 1 5 0" />
  </Base>
);

const OvenIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <rect x="6.5" y="9" width="11" height="9" rx="1" />
    <circle cx="7.5" cy="5.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="5.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="5.5" r="0.8" fill="currentColor" stroke="none" />
  </Base>
);

const HobIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <circle cx="8.5" cy="10.5" r="2" />
    <circle cx="15.5" cy="10.5" r="2" />
    <circle cx="8.5" cy="15" r="1.3" />
    <circle cx="15.5" cy="15" r="1.3" />
  </Base>
);

const CookerIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <circle cx="8" cy="6" r="1.5" />
    <circle cx="16" cy="6" r="1.5" />
    <rect x="6.5" y="10" width="11" height="8" rx="1" />
  </Base>
);

const ExtractorHoodIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 8 L9 4 h6 l5 4" />
    <rect x="4" y="8" width="16" height="3" rx="0.5" />
    <line x1="12" y1="11" x2="12" y2="20" />
  </Base>
);

const ChestFreezerIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="8" width="18" height="10" rx="1.5" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="16" y1="9.5" x2="16" y2="10.5" />
  </Base>
);

const UprightFreezerIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <line x1="5" y1="12" x2="19" y2="12" />
    <line x1="17" y1="6" x2="17" y2="9" />
    <line x1="17" y1="15" x2="17" y2="18" />
  </Base>
);

const FridgeFreezerIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <line x1="5" y1="9" x2="19" y2="9" />
    <line x1="16" y1="5" x2="16" y2="7" />
    <line x1="16" y1="12" x2="16" y2="14" />
  </Base>
);

const MicrowaveOvenIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <rect x="5.5" y="8.5" width="9" height="7" rx="0.5" />
    <circle cx="18" cy="11" r="0.8" fill="currentColor" stroke="none" />
    <line x1="16.5" y1="14" x2="19.5" y2="14" />
  </Base>
);

const WineCoolerIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <rect x="7" y="5.5" width="10" height="13" rx="0.5" />
    <line x1="7" y1="9.5" x2="17" y2="9.5" />
    <line x1="7" y1="13.5" x2="17" y2="13.5" />
  </Base>
);

const SideBySideFridgeIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="10.5" y1="7" x2="10.5" y2="9" />
    <line x1="13.5" y1="7" x2="13.5" y2="9" />
  </Base>
);

const TvIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="16" x2="12" y2="20" />
  </Base>
);

const DryingCabinetIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <line x1="7" y1="8" x2="17" y2="8" />
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="7" y1="16" x2="17" y2="16" />
    <line x1="17" y1="5" x2="17" y2="7" />
  </Base>
);

const GenericProductIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <line x1="4" y1="10" x2="20" y2="10" />
  </Base>
);

const PRODUCT_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  dishwasher: DishwasherIcon,
  washing_machine: WashingMachineIcon,
  tumble_dryer: TumbleDryerIcon,
  oven: OvenIcon,
  hob: HobIcon,
  cooker: CookerIcon,
  extractor_hood: ExtractorHoodIcon,
  chest_freezer: ChestFreezerIcon,
  upright_freezer: UprightFreezerIcon,
  fridge_freezer: FridgeFreezerIcon,
  microwave_oven: MicrowaveOvenIcon,
  wine_cooler: WineCoolerIcon,
  side_by_side_fridge: SideBySideFridgeIcon,
  tv: TvIcon,
  drying_cabinet: DryingCabinetIcon,
};

type ProductIconProps = IconProps & {
  code: string;
  iconKey?: string | null;
};

export function ProductIcon({ code, iconKey, ...props }: ProductIconProps) {
  const key = resolveProductIconKey(code, iconKey);
  const Icon = PRODUCT_ICONS[key] ?? GenericProductIcon;
  return <Icon {...props} />;
}
