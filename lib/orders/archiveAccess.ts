export type BookingArchiveAccess = {
  viewMode: "ADMIN" | "ORDER_CREATOR" | "SUBCONTRACTOR";

  canCreate: boolean;
  canFilterCreatedBy: boolean;
  canFilterSubcontractor: boolean;

  lockedCreatedById?: string;
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
      canCreate: false,
      canFilterCreatedBy: false,
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
      canCreate: true,
      canFilterCreatedBy: true,
      canFilterSubcontractor: true,
    };
  }

  // ORDER CREATOR
  if (canCreate) {
    return {
      viewMode: "ORDER_CREATOR",
      canCreate: true,
      canFilterCreatedBy: false,
      canFilterSubcontractor: true,
      lockedCreatedById: id,
    };
  }

  // SUBCONTRACTOR
  return {
    viewMode: "SUBCONTRACTOR",
    canCreate: false,
    canFilterCreatedBy: false,
    canFilterSubcontractor: false,
    lockedSubcontractorId: id,
  };
}
