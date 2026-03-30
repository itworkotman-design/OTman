import { useEffect, useState } from "react";
import type { AppPermission, Role } from "@/lib/users/types";

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  role: Role;
  permissions: AppPermission[];
};

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        console.log("ME res.ok", res.ok);
        console.log("ME data", data);

        if (!res.ok || !data?.ok) {
          setCurrentUser(null);
          return;
        }

        setCurrentUser({
          id: data.user?.id ?? "",
          email: data.user?.email ?? "",
          username: data.user?.username ?? "",
          role: (data.activeTenant?.role ?? "USER") as Role,
          permissions: data.activeTenant?.permissions ?? [],
        });
      } catch (error) {
        console.error("Failed loading current user", error);
        setCurrentUser(null);
      }
    }

    loadMe();
  }, []);

  return currentUser;
}
