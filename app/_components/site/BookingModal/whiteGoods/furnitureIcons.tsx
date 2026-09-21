import { Base, type IconProps } from "./iconBase";

// Line icons for the website furniture catalog, one per product. Keyed by the
// same lowercased product code resolveProductIconKey derives (FN_BED ->
// "fn_bed"); the FN_ prefix is kept so keys can't collide with white goods.
// Simple geometric drawings in the same style as productIcons.tsx — swap any
// entry (or point Product.iconKey at another key) once real artwork exists.

const BedIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 5.5v14" />
    <path d="M21 13v6.5" />
    <path d="M3 16.5h18" />
    <rect x="5" y="11" width="16" height="5.5" rx="1.2" />
    <rect x="6.5" y="8.6" width="5" height="2.4" rx="1.2" />
  </Base>
);

const MattressIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="7.5" width="18" height="9" rx="2.6" />
    <rect x="5.6" y="9.7" width="12.8" height="4.6" rx="1.4" strokeWidth={1} strokeDasharray="1.6 1.6" />
    <path d="M5 19h14" />
  </Base>
);

const WardrobeIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="2.5" width="16" height="17" rx="1" />
    <line x1="12" y1="2.5" x2="12" y2="19.5" />
    <circle cx="10.2" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="13.8" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
    <path d="M6.5 19.5v2M17.5 19.5v2" />
  </Base>
);

const ChestOfDrawersIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3.5" width="16" height="15.5" rx="1" />
    <line x1="4" y1="8.7" x2="20" y2="8.7" />
    <line x1="4" y1="13.8" x2="20" y2="13.8" />
    <path d="M10.5 6.1h3M10.5 11.2h3M10.5 16.4h3" />
    <path d="M6.5 19v2M17.5 19v2" />
  </Base>
);

const BookcaseIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <path d="M7.5 5v4M10 5.6v3.4M12.5 5v4" />
    <path d="M7.5 11v4M10.5 11.6v3.4" />
    <rect x="14" y="16.8" width="3.5" height="4.2" />
  </Base>
);

const ShelvingUnitIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 3v18M19 3v18" />
    <path d="M5 8h14M5 14h14M5 20h14" />
    <rect x="7.5" y="4" width="4" height="4" />
    <circle cx="15.5" cy="6.2" r="1.7" />
    <rect x="12" y="10.5" width="5" height="3.5" />
  </Base>
);

const CabinetIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="3" width="14" height="17" rx="1" />
    <rect x="7.5" y="5.5" width="9" height="12" rx="0.6" />
    <circle cx="14.5" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
    <path d="M7 20v1.5M17 20v1.5" />
  </Base>
);

const DisplayCabinetIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="2.5" width="14" height="18" rx="1" />
    <rect x="7" y="4.5" width="10" height="10.5" rx="0.6" />
    <path d="M7 9.8h10" />
    <path d="M9 8.2l3-3.2M9 13.6l6-6.6" strokeWidth={1} />
    <line x1="5" y1="17" x2="19" y2="17" />
    <circle cx="12" cy="18.8" r="0.6" fill="currentColor" stroke="none" />
    <path d="M7 20.5V22M17 20.5V22" />
  </Base>
);

const SideboardIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="2.5" y="8" width="19" height="9" rx="1" />
    <line x1="9" y1="8" x2="9" y2="17" />
    <line x1="15" y1="8" x2="15" y2="17" />
    <circle cx="7" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="11" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="17" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
    <path d="M5 17v3M19 17v3" />
  </Base>
);

const TvBenchIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="6" y="2.5" width="12" height="8" rx="1" />
    <path d="M12 10.5v2" />
    <rect x="3" y="12.5" width="18" height="5" rx="1" />
    <line x1="12" y1="12.5" x2="12" y2="17.5" />
    <path d="M5.5 17.5v3M18.5 17.5v3" />
  </Base>
);

const BedsideTableIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9.6 5.6l1.2-3.1h2.4l1.2 3.1z" />
    <line x1="12" y1="5.6" x2="12" y2="8.5" />
    <rect x="6" y="8.5" width="12" height="9" rx="1" />
    <line x1="6" y1="13" x2="18" y2="13" />
    <circle cx="12" cy="10.8" r="0.6" fill="currentColor" stroke="none" />
    <path d="M7.5 17.5v3.5M16.5 17.5v3.5" />
  </Base>
);

const DiningTableIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="8" width="18" height="2.4" rx="1" />
    <path d="M5.5 10.4V20M18.5 10.4V20" />
    <path d="M5.5 12.5h13" strokeWidth={1} />
  </Base>
);

const DiningSetIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="7" y="10" width="10" height="1.8" rx="0.8" />
    <path d="M8.5 11.8V19M15.5 11.8V19" />
    <path d="M3.5 7v12M3.5 14h3M6 14v5" />
    <path d="M20.5 7v12M20.5 14h-3M18 14v5" />
  </Base>
);

const ChairIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="7" y="2.5" width="10" height="7.5" rx="1.2" />
    <path d="M8.5 10v2M15.5 10v2" />
    <rect x="6" y="12" width="12" height="2.6" rx="1" />
    <path d="M7.5 14.6V21M16.5 14.6V21" />
  </Base>
);

const OfficeChairIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="8" y="2.5" width="8" height="8" rx="2.5" />
    <path d="M12 10.5v1.5" />
    <rect x="6.5" y="12" width="11" height="2.6" rx="1.2" />
    <line x1="12" y1="14.6" x2="12" y2="18.5" />
    <path d="M6.5 18.5h11" />
    <circle cx="7" cy="20.7" r="0.9" />
    <circle cx="12" cy="20.7" r="0.9" />
    <circle cx="17" cy="20.7" r="0.9" />
  </Base>
);

const DeskIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="2.5" y="8" width="19" height="2.2" rx="0.9" />
    <path d="M4.5 10.2V20" />
    <rect x="14.5" y="10.2" width="6" height="9.8" />
    <line x1="14.5" y1="15" x2="20.5" y2="15" />
    <path d="M16.8 12.6h1.4M16.8 17.6h1.4" />
  </Base>
);

const SofaIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="4.5" width="14" height="7" rx="2" />
    <rect x="2.5" y="9" width="3.8" height="8.5" rx="1.6" />
    <rect x="17.7" y="9" width="3.8" height="8.5" rx="1.6" />
    <rect x="6.3" y="11.5" width="11.4" height="5" rx="1" />
    <path d="M5 17.5v2M19 17.5v2" />
  </Base>
);

const SofaBedIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4.5" y="4.5" width="15" height="6" rx="2" />
    <rect x="2.5" y="8.5" width="3.8" height="7.5" rx="1.6" />
    <rect x="17.7" y="8.5" width="3.8" height="7.5" rx="1.6" />
    <rect x="6.3" y="10.5" width="11.4" height="5.5" rx="1" />
    <path d="M6 19.5h12" strokeDasharray="2 2" />
    <path d="M5 16v1M19 16v1" />
  </Base>
);

const ArmchairRecliner = (props: IconProps) => (
  <Base {...props}>
    <rect x="6.5" y="3.5" width="11" height="9" rx="2.6" />
    <rect x="3" y="9" width="4" height="8.5" rx="1.7" />
    <rect x="17" y="9" width="4" height="8.5" rx="1.7" />
    <rect x="7.5" y="12" width="9" height="4.5" rx="1" />
    <path d="M6 17.5v2.5M18 17.5v2.5" />
  </Base>
);

const CoffeeTableIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="9.5" width="18" height="2.4" rx="1.1" />
    <path d="M5.8 11.9l-1 7.6M18.2 11.9l1 7.6" />
    <path d="M6.3 16.2h11.4" />
  </Base>
);

const OutdoorFurnitureIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3.5 10.5C3.5 6.6 7.3 3.5 12 3.5s8.5 3.1 8.5 7z" />
    <path d="M12 3.5v17.5" />
    <path d="M8.5 10.5c.4-2.5 1.8-4.6 3.5-7M15.5 10.5c-.4-2.5-1.8-4.6-3.5-7" strokeWidth={1} />
    <path d="M8.5 21h7" />
  </Base>
);

const ChildrensFurnitureIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="2.5" y="11" width="11.5" height="1.9" rx="0.9" />
    <path d="M4.5 12.9V19M12 12.9V19" />
    <path d="M17 8v11M17 14.5h3.5M20 14.5V19" />
    <path
      transform="translate(2.6 -1.6)"
      d="M6 5.5l.8 1.7 1.8.2-1.3 1.2.4 1.8L6 9.5 4.3 10.4l.4-1.8L3.4 7.4l1.8-.2z"
      strokeWidth={1.1}
    />
  </Base>
);

const OtherFurnitureIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" strokeDasharray="3 2.2" />
    <circle cx="8.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const FURNITURE_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  fn_bed: BedIcon,
  fn_mattress: MattressIcon,
  fn_wardrobe: WardrobeIcon,
  fn_chest_of_drawers: ChestOfDrawersIcon,
  fn_bookcase: BookcaseIcon,
  fn_shelving_unit: ShelvingUnitIcon,
  fn_cabinet: CabinetIcon,
  fn_display_cabinet: DisplayCabinetIcon,
  fn_sideboard: SideboardIcon,
  fn_tv_bench: TvBenchIcon,
  fn_bedside_table: BedsideTableIcon,
  fn_dining_table: DiningTableIcon,
  fn_dining_set: DiningSetIcon,
  fn_chair: ChairIcon,
  fn_office_chair: OfficeChairIcon,
  fn_desk: DeskIcon,
  fn_sofa: SofaIcon,
  fn_sofa_bed: SofaBedIcon,
  fn_armchair_recliner: ArmchairRecliner,
  fn_coffee_table: CoffeeTableIcon,
  fn_outdoor_furniture: OutdoorFurnitureIcon,
  fn_childrens_furniture: ChildrensFurnitureIcon,
  fn_other_furniture: OtherFurnitureIcon,
};
