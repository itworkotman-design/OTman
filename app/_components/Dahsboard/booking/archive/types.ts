import type { OrderSummaryGroup } from "@/lib/orders/orderSummary";

export type BookingArchiveViewMode =
  | "ADMIN"
  | "SUBCONTRACTOR"
  | "ORDER_CREATOR";

export type BookingArchiveFilters = {
  status: string;
  search: string;
  fromDate: string;
  toDate: string;

  subcontractorId: string;
  customerMembershipId: string;

  page: number;
  rowsPerPage: number;
};

export type BookingArchiveAccess = {
  viewMode: BookingArchiveViewMode;
  canEdit: boolean;
  canFilterSubcontractor: boolean;
  canFilterCreatedBy: boolean;
  lockedSubcontractorId: string | null;
  lockedCreatedById: string | null;
};

export type BookingArchiveOption = {
  id: string;
  label: string;
};

export type OrderRow = {
  id: string;
  displayId: number;
  status: string;
  statusNotes: string;
  deliveryDate: string;
  timeWindow: string;
  customerName: string;
  customerLabel: string;
  orderNumber: string;
  phone: string;
  email: string;
  pickupAddress: string;
  extraPickupAddress: string[];
  deliveryAddress: string;
  orderSummaryGroups: OrderSummaryGroup[];
  orderSummaryText: string;
  productsSummary: string;
  deliveryTypeSummary: string;
  servicesSummary: string;
  description: string;
  cashierName: string;
  cashierPhone: string;
  customerComments: string;
  driverInfo: string;
  subcontractorMembershipId: string;
  driver: string;
  createdAt: string;
  updatedAt: string;
  lastInboundEmailAt: string | null;
  lastOutboundEmailAt: string | null;
  needsEmailAttention: boolean;
  unreadInboundEmailCount: number;
  lastNotificationAt: string | null;
  needsNotificationAttention: boolean;
  unreadNotificationCount: number;
  priceExVat: number;
  priceSubcontractor: number;
  customerMembershipId: string;
  createdBy: string;
  lastEditedBy: string;
  subcontractor: string;
};
