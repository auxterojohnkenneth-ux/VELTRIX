"use client";

import { ReactNode, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";

type User = {
  username: string;
  firstName: string;
  lastName: string;
  role: string;
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const userData = useSyncExternalStore(
    subscribeToSession,
    getStoredUser,
    () => null,
  );
  const user = useMemo(() => {
    if (!userData) {
      return null;
    }

    try {
      return JSON.parse(userData) as User;
    } catch {
      return null;
    }
  }, [userData]);

  if (!user) {
    return children;
  }

  return (
    <DashboardShell user={user} pathname={pathname}>
      {children}
    </DashboardShell>
  );
}

function subscribeToSession(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getStoredUser() {
  return sessionStorage.getItem("user");
}
