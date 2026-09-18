// Resolves which entry of the local icon registry (productIcons.tsx) a
// product should render. Product.iconKey (DB, optional) always wins so an
// icon can be swapped without a deploy; otherwise it's derived from the
// product code so seeded products get a sensible icon "for free".
export function resolveProductIconKey(code: string, iconKey?: string | null): string {
  if (iconKey) return iconKey;
  const withoutPrefix = code.replace(/^WG_/i, "");
  return withoutPrefix.toLowerCase();
}
