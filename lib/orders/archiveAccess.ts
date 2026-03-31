type Membership = {
  id: string;
  role: "OWNER" | "ADMIN" | "USER";
  permissions: string[];
};


export type BookingArchiveAccess = {
  viewMode: "ADMIN" | "ORDER_CREATOR" | "SUBCONTRACTOR";

  canFilterCustomer: boolean;
  canFilterSubcontractor: boolean;

  lockedCustomerMembershipId?: string;
  lockedSubcontractorId?: string;
};

export function getBookingArchiveAccess(
  user: {
    membershipId?: string;
    role?: "OWNER" | "ADMIN" | "USER";
    permissions?: string[];
  } | null,
): BookingArchiveAccess {
  if (!user) {
    return {
      viewMode: "SUBCONTRACTOR",
      canFilterCustomer: false,
      canFilterSubcontractor: false,
    };
  }

  const id = user.membershipId ?? "";
  const role = user.role ?? "USER";
  const permissions = user.permissions ?? [];

  const isAdminOrOwner = role === "OWNER" || role === "ADMIN";
  const canCreate = permissions.includes("BOOKING_CREATE");

  // ADMIN / OWNER
  if (isAdminOrOwner) {
    return {
      viewMode: "ADMIN",
      canFilterCustomer: true,
      canFilterSubcontractor: true,
    };
  }

  // ORDER CREATOR
  if (canCreate) {
    return {
      viewMode: "ORDER_CREATOR",
      canFilterCustomer: false,
      canFilterSubcontractor: true,
      lockedCustomerMembershipId: id,
    };
  }

  // SUBCONTRACTOR
  return {
    viewMode: "SUBCONTRACTOR",
    canFilterCustomer: false,
    canFilterSubcontractor: false,
    lockedSubcontractorId: id,
  };
}
