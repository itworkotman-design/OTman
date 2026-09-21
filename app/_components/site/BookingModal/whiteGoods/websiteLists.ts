// A website price list the order flow can offer, as returned by the catalog
// API's availableLists.
export type WebsiteListInfo = { code: string; labelEn: string; labelNo: string };

// "Any other products?" offers every available list except the ones already
// added to the order (the first, white goods, counts as used).
export function filterUnusedLists(available: WebsiteListInfo[], usedCodes: string[]): WebsiteListInfo[] {
  return available.filter((list) => !usedCodes.includes(list.code));
}
