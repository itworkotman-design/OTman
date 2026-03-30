import { getAccessTypeFromRoleAndPermissions } from "@/lib/users/userAccess";
import type { AppPermission, Role } from "@/lib/users/types";

import {
  OrderFields,
  type HiddenMask,
  type OrderFieldValue,
} from "@/app/_components/Dahsboard/booking/create/orderFields";

function hide(...fields: OrderFieldValue[]): HiddenMask {
  return fields.reduce((mask, field) => mask | field, 0);
}

export function getCreateOrderHiddenMask(
  role: Role,
  permissions: AppPermission[],
): HiddenMask {
  const accessType = getAccessTypeFromRoleAndPermissions(role, permissions);

  // Admin + Owner => show everything
  if (role === "ADMIN" || role === "OWNER" || accessType === null) {
    return 0;
  }

  // Order creator => hide admin-only fields
  if (accessType === "ORDER_CREATOR") {
    return hide(
      OrderFields.Subcontractor,
      OrderFields.Driver1,
      OrderFields.Driver2,
      OrderFields.DriverInfo,
      OrderFields.LicensePlate,
      OrderFields.Deviation,
      OrderFields.StatusNotes,
      OrderFields.ChangeCustomer,
      OrderFields.Status,
    );
  }

  // Subcontractor should normally not create orders,
  // but if they somehow reach this page, hide admin-only fields too.
  return hide(
    OrderFields.Subcontractor,
    OrderFields.Driver1,
    OrderFields.Driver2,
    OrderFields.DriverInfo,
    OrderFields.LicensePlate,
    OrderFields.Deviation,
    OrderFields.StatusNotes,
    OrderFields.ChangeCustomer,
    OrderFields.Status,
  );
}
