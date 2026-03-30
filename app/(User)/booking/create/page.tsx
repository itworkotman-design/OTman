"use client";

import CreatePage from "@/app/(User)/dashboard/booking/create/page"
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { getCreateOrderHiddenMask } from "@/lib/booking/orderFormVisibility";
import type { AppPermission } from "@/lib/users/types";

export default function BookingCreateScreen() {
  const currentUser = useCurrentUser();

  const role = currentUser?.role ?? "USER";
  const permissions = (currentUser?.permissions ?? []) as AppPermission[];

  const hidden = getCreateOrderHiddenMask(role, permissions);

  const isOrderCreator =
    role === "USER" && permissions.includes("BOOKING_CREATE");

  return <CreatePage hidden={hidden} hideDontSendEmail={isOrderCreator} />;
}
