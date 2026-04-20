import type { BookingArchiveFilters } from "@/app/_components/Dahsboard/booking/archive/types";

export const DEFAULT_BOOKING_ARCHIVE_FILTERS: BookingArchiveFilters = {
  status: "",
  customerMembershipId: "",
  subcontractorId: "",
  fromDate: "",
  toDate: "",
  search: "",
  rowsPerPage: 10,
  page: 1,
};

function toIsoDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getTodayRange() {
  const iso = toIsoDate(new Date());
  return { fromDate: iso, toDate: iso };
}

export function getTomorrowRange() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const iso = toIsoDate(d);
  return { fromDate: iso, toDate: iso };
}

export function getThisWeekRange() {
  const d = new Date();
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    fromDate: toIsoDate(monday),
    toDate: toIsoDate(sunday),
  };
}

export function getThisMonthRange() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    fromDate: toIsoDate(firstDay),
    toDate: toIsoDate(lastDay),
  };
}
