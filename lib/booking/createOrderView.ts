import { getCreateOrderHiddenMask } from "@/lib/booking/orderFormVisibility";
import { getUserAccessType } from "@/lib/users/access";
import type { AppPermission, Role } from "@/lib/users/types";

export function getCreateOrderViewConfig(
  role: Role,
  permissions: AppPermission[],
  hidden: number,
  hideDontSendEmail: boolean,
) {
  const accessType = getUserAccessType(role, permissions);

  return {
    accessType,
    effectiveHidden: hidden | getCreateOrderHiddenMask(role, permissions),
    effectiveHideDontSendEmail:
      hideDontSendEmail || accessType === "ORDER_CREATOR",
  };
}
