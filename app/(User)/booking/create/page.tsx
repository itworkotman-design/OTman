"use client";

import CreatePage from "@/app/(User)/dashboard/booking/create/page"; // use your real component path
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { getCreateOrderHiddenMask } from "@/lib/booking/orderFormVisibility";
import type { AppPermission } from "@/lib/users/types";
import { getUserAccessType } from "@/lib/users/access";

export default function BookingCreateScreen() {
  const currentUser = useCurrentUser();

  const role = currentUser?.role ?? "USER";
  const permissions = (currentUser?.permissions ?? []) as AppPermission[];

  const hidden = getCreateOrderHiddenMask(role, permissions);
  const accessType = getUserAccessType(role, permissions);
  const hideDontSendEmail = accessType === "ORDER_CREATOR";

  return <CreatePage hidden={hidden} hideDontSendEmail={hideDontSendEmail} />;
}
