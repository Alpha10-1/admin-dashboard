import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS: { label: string; icon: string; to?: string }[] = [
  { label: "Dashboard", icon: "grid", to: "/" },
  { label: "Drivers", icon: "car", to: "/drivers" },
  { label: "Riders", icon: "user", to: "/riders" },
  { label: "Documents", icon: "file", to: "/documents" },
  { label: "Promotions", icon: "tag", to: "/promotions" },
  { label: "Rides", icon: "route", to: "/rides" },
  { label: "Wallets", icon: "wallet", to: "/wallets" },
  { label: "SOS", icon: "sos", to: "/sos" },
  { label: "Pricing", icon: "dollar", to: "/pricing" },
  { label: "Support", icon: "chat", to: "/support" },
  { label: "Admins", icon: "shield", to: "/admins" },
  { label: "Content", icon: "edit", to: "/content" },
];

function NavIcon({ name }: { name: string }) {
  // Minimal inline icon set — no icon library dependency for a handful of glyphs.
  const paths: Record<string, string> = {
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    car: "M5 17a2 2 0 104 0 2 2 0 00-4 0zM15 17a2 2 0 104 0 2 2 0 00-4 0zM3 17V11l2-5h10l3 5v6M3 11h17",
    user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
    file: "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5",
    tag: "M20 12l-8 8-9-9V4h7l9 9zM7 7h.01",
    route: "M4 19a2 2 0 100-4 2 2 0 000 4zM20 5a2 2 0 100 4 2 2 0 000-4zM6 19h6a4 4 0 004-4V9a4 4 0 014-4",
    chat: "M21 12a8 8 0 01-11.6 7.1L4 20l1.2-4.9A8 8 0 1121 12z",
    shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    wallet: "M3 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 12h3M3 9h18",
    sos: "M12 2L2 20h20L12 2zM12 9v5M12 17h.01",
    dollar: "M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5 2.2 3 5 3.5c2.8.5 5 1.6 5 3.5s-2.2 3.5-5 3.5-5-1.6-5-3.5",
  };
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { admin, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-bg flex">
      <aside className="w-60 shrink-0 border-r border-border flex flex-col p-4">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="live-pulse" />
          <span className="font-display font-semibold tracking-tight">
            ride-native <span className="text-textFaint font-body font-normal text-sm">admin</span>
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accentDim text-accent"
                      : "text-textDim hover:bg-surfaceRaised hover:text-white"
                  }`
                }
              >
                <NavIcon name={item.icon} />
                {item.label}
              </NavLink>
            ) : (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-textFaint cursor-not-allowed"
                title="Not built yet"
              >
                <span className="flex items-center gap-3">
                  <NavIcon name={item.icon} />
                  {item.label}
                </span>
                <span className="text-[10px] uppercase tracking-wide border border-border rounded-full px-1.5 py-0.5">
                  Soon
                </span>
              </div>
            )
          )}
        </nav>

        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-sm font-medium px-2">{admin?.first_name} {admin?.last_name}</p>
          <p className="text-xs text-textFaint px-2 mb-3">@{admin?.username}</p>
          <button
            onClick={signOut}
            className="w-full text-left px-2 py-2 text-sm text-textDim hover:text-accent transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
