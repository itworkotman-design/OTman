// The navbar's "Login" goes to the dashboard login (staff, business
// customers). On the "My order" pages it only confuses homepage customers,
// who have their own login there — so it is hidden on those.
export function showsDashboardLogin(pathname: string | null): boolean {
  if (!pathname) return true;
  return !/^\/(no|en)\/min-bestilling(\/|$)/.test(pathname);
}
