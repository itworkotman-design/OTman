import React from "react";
import type { Role, AppPermission } from "@/lib/users/types";

export type { Role, AppPermission };

export interface UserFormData {
  username: string;
  email: string;
  phoneNumber: string;
  role: string;
  active: boolean;
  description: string;
  priceListId: string | null;
  permissions: AppPermission[];
}

export interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UserFormData) => void | Promise<void>;
  onRemove: () => boolean | Promise<boolean>;
  onToggleActive: () => void | Promise<void>;
  initialValueUsername: string;
  initialValueEmail: string;
  initialValuePhoneNumber: string;
  initialValueDescription: string;
  initialValueRole: string;
  initialValueActive: boolean;
  initialValuePermissions?: AppPermission[];
  actorRole: Role;
  targetRole: Role;
  priceLists?: { id: string; name: string }[];
  initialPriceListId?: string | null;
}

export type UserFormSource = Pick<
  UserModalProps,
  | "initialValueUsername"
  | "initialValueEmail"
  | "initialValuePhoneNumber"
  | "initialValueDescription"
  | "initialValueRole"
  | "initialValueActive"
  | "initialValuePermissions"
  | "initialPriceListId"
>;

export function buildInitialForm(source: UserFormSource): UserFormData {
  return {
    username: source.initialValueUsername ?? "",
    email: source.initialValueEmail ?? "",
    phoneNumber: source.initialValuePhoneNumber ?? "",
    description: source.initialValueDescription ?? "",
    role: source.initialValueRole || "USER",
    active: source.initialValueActive,
    priceListId: source.initialPriceListId ?? null,
    permissions: source.initialValuePermissions ?? ["BOOKING_VIEW"],
  };
}

export function getPermissions(
  actorRole: Role,
  targetRole: Role,
  isCreateMode: boolean,
) {
  const isActorOwner = actorRole === "OWNER";
  const isActorAdmin = actorRole === "ADMIN";
  const isTargetOwner = targetRole === "OWNER";

  const canEditTarget =
    isCreateMode || isActorOwner || (isActorAdmin && targetRole === "USER");

  const canDisableOrRemove =
    !isCreateMode &&
    ((isActorOwner && !isTargetOwner) ||
      (isActorAdmin && targetRole === "USER"));

  return { isActorOwner, isActorAdmin, canEditTarget, canDisableOrRemove };
}

export function getSaveButtonLabel(
  isCreateMode: boolean,
  canEditTarget: boolean,
) {
  if (isCreateMode) return "Send Invite";
  if (!canEditTarget) return "You cannot edit this user";
  return "Save Changes";
}

export function makeFieldUpdater(
  key: "username" | "email" | "phoneNumber" | "description",
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>,
) {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
}

export function makeSelectUpdater(
  key: "role" | "priceListId",
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>,
) {
  return (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((prev) => ({
      ...prev,
      [key]: key === "priceListId" ? e.target.value || null : e.target.value,
    }));
}

export type UserAccessType = "SUBCONTRACTOR" | "ORDER_CREATOR";

export function getAccessTypeFromPermissions(
  permissions: AppPermission[],
): UserAccessType {
  return permissions.includes("BOOKING_CREATE")
    ? "ORDER_CREATOR"
    : "SUBCONTRACTOR";
}

export function getPermissionsFromAccessType(
  accessType: UserAccessType,
): AppPermission[] {
  return accessType === "ORDER_CREATOR"
    ? ["BOOKING_VIEW", "BOOKING_CREATE"]
    : ["BOOKING_VIEW"];
}
