import type { ActiveMembership } from "@/lib/auth/membership";

// ─── Re-exported from auth — single source of truth ──────────────────────────

export type Role = ActiveMembership["role"];

// ─── Status enums ─────────────────────────────────────────────────────────────

export type UserStatus = "ACTIVE" | "DISABLED";
export type MembershipStatus = "ACTIVE" | "DISABLED" | "INVITED";
export type PriceList = "DEFAULT" | "POWER";

// ─── Domain shapes ────────────────────────────────────────────────────────────

export type MembershipUser = {
  id: string;
  email: string;
  status: UserStatus;
};

export type Membership = {
  id: string;
  role: Role;
  status: MembershipStatus;
  createdAt: string;
  user: MembershipUser;
};