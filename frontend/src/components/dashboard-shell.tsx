"use client";

import { ReactNode, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Role = "WAREHOUSE_STAFF" | "LOGISTICS_MANAGER" | "SYSTEM_ADMIN";

type User = {
  username: string;
  firstName: string;
  lastName: string;
  role: string;
};

type NavigationEntry = {
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
};

const navigation: Record<Role, NavigationEntry[]> = {
  WAREHOUSE_STAFF: [
    {
      label: "Overview",
      href: "/dashboard/warehouse",
      icon: "grid",
      exact: true,
    },
    {
      label: "Inventory",
      href: "/dashboard/warehouse/inventory",
      icon: "box",
    },
    {
      label: "Shipments",
      href: "/dashboard/warehouse/shipments",
      icon: "truck",
    },
    {
      label: "Transfers",
      href: "/dashboard/warehouse/transfers",
      icon: "transfer",
    },
  ],
  LOGISTICS_MANAGER: [
    {
      label: "Overview",
      href: "/dashboard/logistics",
      icon: "grid",
      exact: true,
    },
    {
      label: "Shipments",
      href: "/dashboard/logistics#shipments",
      icon: "truck",
    },
    {
      label: "Drivers",
      href: "/dashboard/logistics#drivers",
      icon: "users",
    },
    {
      label: "Vehicles",
      href: "/dashboard/logistics#vehicles",
      icon: "box",
    },
    {
      label: "Routes",
      href: "/dashboard/logistics#routes",
      icon: "route",
    },
  ],
  SYSTEM_ADMIN: [
    {
      label: "Overview",
      href: "/dashboard/admin",
      icon: "grid",
      exact: true,
    },
    {
      label: "Users",
      href: "/dashboard/admin#users",
      icon: "users",
    },
    {
      label: "Warehouses",
      href: "/dashboard/admin#warehouses",
      icon: "box",
    },
    {
      label: "System overview",
      href: "/dashboard/admin#overview",
      icon: "grid",
    },
    {
      label: "Audit activity",
      href: "/dashboard/admin#audit",
      icon: "history",
    },
  ],
};

const pageTitles: Record<string, string> = {
  "/dashboard/warehouse": "Warehouse overview",
  "/dashboard/warehouse/inventory": "Inventory",
  "/dashboard/warehouse/shipments": "Incoming shipments",
  "/dashboard/warehouse/transfers": "Stock transfers",
  "/dashboard/logistics": "Logistics overview",
  "/dashboard/admin": "System overview",
};

function isRole(role: string): role is Role {
  return role in navigation;
}

function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    box: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.2V21" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7.5" cy="18" r="1.7" />
        <circle cx="17.5" cy="18" r="1.7" />
      </>
    ),
    transfer: (
      <>
        <path d="M4 7h15l-3-3M20 17H5l3 3" />
        <path d="M17 4l3 3-3 3M7 14l-3 3 3 3" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6v1" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M8 18h4a4 4 0 0 0 4-4V10a4 4 0 0 1 4-4" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function DashboardShell({
  user,
  pathname,
  children,
}: {
  user: User;
  pathname: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeHash = useSyncExternalStore(
    subscribeToHash,
    getCurrentHash,
    () => "",
  );

  if (!isRole(user.role)) {
    return children;
  }

  function subscribeToHash(onStoreChange: () => void) {
    window.addEventListener("hashchange", onStoreChange);
    return () => window.removeEventListener("hashchange", onStoreChange);
  }

  function getCurrentHash() {
    return window.location.hash;
  }

  const entries = navigation[user.role];
  const title = pageTitles[pathname] ?? "VELTRIX workspace";
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`;

  function handleLogout() {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("user");
    router.replace("/");
  }

  function isActive(entry: NavigationEntry) {
    if (entry.href.includes("#")) {
      const [entryPath, entryHash] = entry.href.split("#");
      return pathname === entryPath && activeHash === `#${entryHash}`;
    }

    const hasSectionLinks = entries.some(
      (candidate) => candidate.href.startsWith(`${pathname}#`),
    );
    return entry.exact
      ? pathname === entry.href && (!hasSectionLinks || !activeHash)
      : pathname === entry.href || pathname.startsWith(`${entry.href}/`);
  }

  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`app-sidebar${menuOpen ? " is-open" : ""}`}>
        <Link
          className="brand-lockup"
          href={entries[0].href}
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-mark">V</span>
          <span className="brand-name">VELTRIX</span>
        </Link>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {entries.map((entry) => (
            <Link
              key={entry.label}
              href={entry.href}
              className={`sidebar-link${isActive(entry) ? " active" : ""}`}
              aria-current={isActive(entry) ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <NavigationIcon name={entry.icon} />
              <span>{entry.label}</span>
              {isActive(entry) && <span className="nav-active-mark" />}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-role">
            <span className="role-indicator" />
            <span>{user.role.replaceAll("_", " ").toLowerCase()}</span>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
          >
            <NavigationIcon name="logout" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-context">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <span className="topbar-kicker">VELTRIX OPERATIONS</span>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-profile">
            <div className="profile-copy">
              <strong>{user.firstName} {user.lastName}</strong>
              <span>{user.role.replaceAll("_", " ")}</span>
            </div>
            <span className="profile-avatar" aria-hidden="true">
              {initials}
            </span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
