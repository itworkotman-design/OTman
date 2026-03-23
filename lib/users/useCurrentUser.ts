"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/users/types";

export type CurrentUser = {
  email: string;
  role: Role;
  activeCompanyId: string | null;
};

export function useCurrentUser(): CurrentUser | null {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) return;

        const activeCompanyId = data.session?.activeCompanyId ?? null;
        const activeMembership = data.memberships?.find(
          (m: { companyId: string; role: Role }) =>
            m.companyId === activeCompanyId
        );

        setCurrentUser({
          email: data.user.email,
          role: activeMembership?.role ?? "USER",
          activeCompanyId,
        });
      })
      .catch(() => null);
  }, []);

  return currentUser;
}