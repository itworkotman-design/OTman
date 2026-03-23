import React from "react";
import type { Role, PriceList } from "@/lib/users/types";

// ─── UI-specific types ────────────────────────────────────────────────────────

export type { Role, PriceList };

export interface UserFormData {
  name: string;
  email: string;
  number: number;
  role: string;
  active: boolean;
  description: string;
  priceList: PriceList;
}

export interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UserFormData) => void;
  onRemove: () => void;
  onToggleActive: () => void;
  initialValueName: string;
  initialValueEmail: string;
  initialValueNumber: number;
  initialValueRole: string;
  initialValueActive: boolean;
  actorRole: Role;
  targetRole: Role;
}

// ─── Initial form state ───────────────────────────────────────────────────────

export function buildInitialForm(props: UserModalProps): UserFormData {
  return {
    name: props.initialValueName,
    email: props.initialValueEmail,
    number: props.initialValueNumber,
    role: props.initialValueRole || "USER",
    active: props.initialValueActive,
    description: "",
    priceList: "DEFAULT",
  };
}

// ─── Permission helpers ───────────────────────────────────────────────────────

export function getPermissions(
  actorRole: Role,
  targetRole: Role,
  isCreateMode: boolean
) {
  const isActorOwner = actorRole === "OWNER";
  const isActorAdmin = actorRole === "ADMIN";
  const isTargetOwner = targetRole === "OWNER";

  const canEditTarget =
    isCreateMode ||
    isActorOwner ||
    (isActorAdmin && targetRole === "USER");

  const canDisableOrRemove =
    !isCreateMode &&
    ((isActorOwner && !isTargetOwner) ||
      (isActorAdmin && targetRole === "USER"));

  return { isActorOwner, isActorAdmin, canEditTarget, canDisableOrRemove };
}

export function getSaveButtonLabel(
  isCreateMode: boolean,
  canEditTarget: boolean
) {
  if (isCreateMode) return "Send Invite";
  if (!canEditTarget) return "You cannot edit this user";
  return "Save Changes";
}

// ─── Form field updaters ──────────────────────────────────────────────────────

export function makeFieldUpdater(
  key: "name" | "email" | "description",
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>
) {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
}

export function makeNumberUpdater(
  key: "number",
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>
) {
  return (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }));
}

export function makeSelectUpdater(
  key: "role" | "priceList",
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>
) {
  return (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
}