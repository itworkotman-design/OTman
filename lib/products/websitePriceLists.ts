// A price list is a public-website one when its name contains "Website" (any
// case) — the convention the website catalog seeds follow ("Website — Parcel/
// Pallet" …) and that the edit-prices page already relied on for the English
// description column. The editor also uses it to group these apart from the
// booking price lists.
export function isWebsitePriceList(name: string | null | undefined): boolean {
  return (name ?? "").toLowerCase().includes("website");
}

export function splitWebsitePriceLists<T extends { name: string }>(priceLists: T[]) {
  return {
    regular: priceLists.filter((list) => !isWebsitePriceList(list.name)),
    website: priceLists.filter((list) => isWebsitePriceList(list.name)),
  };
}
