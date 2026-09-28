import { Base, type IconProps } from "./iconBase";

// Line icons for the website parcel/pallet catalog, one per product. Keyed
// by the same lowercased product code resolveProductIconKey derives
// (PKG_POSE -> "pkg_pose"); the PKG_ prefix is kept so keys can't collide
// with white goods/furniture. Simple geometric drawings in the same style
// as productIcons.tsx/furnitureIcons.tsx — swap any entry (or point
// Product.iconKey at another key) once real artwork exists.

const BagIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M7 9h10l1 11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
    <path d="M9.5 9V7a2.5 2.5 0 0 1 5 0v2" />
  </Base>
);

// Boxes/pallet/half-pallet below use donated artwork rather than a
// hand-drawn shape (Boxes is Lucide's "package" icon, MIT-licensed —
// https://lucide.dev/license; the two pallets are custom-supplied), all
// normalized into the exact same 0 0 24 24 canvas Base uses rather than
// each keeping its own native viewBox: letting the two pallets' very
// different (non-square) source viewBoxes drive their own scaling made
// them come out both thinner-stroked *and* visibly smaller than the rest of
// the set once actually rendered side by side. Now every icon here — this
// file's and every hand-drawn one in productIcons.tsx/furnitureIcons.tsx —
// shares one rule: a 24x24 canvas, ~20-unit-tall/wide content, 1.5 stroke.
// For the two pallets, that means a `<g>` transform scaling their native
// coordinates down into that canvas, with the path's own strokeWidth
// pre-divided by the same scale factor so it renders at an effective 1.5
// after the transform, not the much thinner line their large source
// coordinates would otherwise produce.
const BoxesIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
    <path d="M12 22V12" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <path d="m7.5 4.27 9 5.15" />
  </Base>
);

// Half-pallet and pallet now share the exact same source viewBox (62x61,
// hence the same transform/scale/strokeWidth below) — the "half" vs "full"
// distinction is drawn INTO the artwork itself (2 support feet vs 3 feet +
// a center support), not by scaling one silhouette smaller than the other,
// which is what made them hard to tell apart at a glance.
const HalfPalletIcon = (props: IconProps) => (
  <Base {...props}>
    <g transform="translate(12 12) scale(0.3306) translate(-30.55 -30.5)">
      <path strokeWidth={4.54} d="M9.60547 0.5007L0.605469 47.1667H60.6055L51.6055 0.5L9.60547 0.5007Z" />
      <path strokeWidth={4.54} d="M0.605469 47.6432V60.5003H14.6055V55.2622H46.6055V60.5003H60.6055V47.167" />
      <path strokeWidth={4.54} d="M20.6055 47.1667L23.6055 0.5" />
      <path strokeWidth={4.54} d="M41.1055 47.1667L37.6055 0.5" />
    </g>
  </Base>
);

const PalletIcon = (props: IconProps) => (
  <Base {...props}>
    <g transform="translate(12 12) scale(0.3306) translate(-30.55 -30.5)">
      <path strokeWidth={4.54} d="M9.60547 0.500701L0.605469 47.2726H60.6055L51.6055 0.5L9.60547 0.500701Z" />
      <path strokeWidth={4.54} d="M0.605469 47.7439V60.4999H14.6055V55.5H17.6055H23.6055V60.4999H37.6055V55.5H43.6055H46.6055V60.4999H60.6055V47.2715" />
      <path strokeWidth={4.54} d="M41.1055 0.972656L45.3555 47.2721" />
      <path strokeWidth={4.54} d="M19.8555 0.972656L15.6055 47.2721" />
      <path strokeWidth={4.54} d="M30.6055 47.2719V0.5" />
    </g>
  </Base>
);

const EnvelopeIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="6" width="18" height="13" rx="1.5" />
    <path d="M3.5 7l8.5 7 8.5-7" />
  </Base>
);

export const PARCEL_PALLET_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  pkg_konvolutt: EnvelopeIcon,
  pkg_pose: BagIcon,
  pkg_esker: BoxesIcon,
  pkg_halvpall: HalfPalletIcon,
  pkg_pall: PalletIcon,
};
