import {
  OrderFields,
  type HiddenMask,
  type OrderFieldValue,
} from "@/app/_components/Dahsboard/booking/create/orderFields";
import { getUserAccessType } from "@/lib/users/access";
import type { AppPermission, Role } from "@/lib/users/types";

function hide(...fields: OrderFieldValue[]): HiddenMask {
  return fields.reduce((mask, field) => mask | field, 0);
}

export function getCreateOrderHiddenMask(
  role: Role,
  permissions: AppPermission[],
): HiddenMask {
  const accessType = getUserAccessType(role, permissions);

  if (accessType === "FULL_ACCESS") {
    return 0;
  }

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
