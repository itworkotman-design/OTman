import type { SVGProps } from "react";

// Shared 24x24 line-icon wrapper for the website product icon sets
// (productIcons.tsx for white goods, furnitureIcons.tsx for furniture).
export type IconProps = SVGProps<SVGSVGElement>;

export function Base({ children, ...props }: IconProps) {
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
