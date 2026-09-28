"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavigationItem {
  label: string;
  href: string;
  icon: string;
}

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: "▦",
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: "♙",
  },
  {
    label: "Processing",
    href: "/admin/processing",
    icon: "↻",
  },
  {
    label: "System",
    href: "/admin/system",
    icon: "⚙",
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-950 text-white">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-slate-800 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-900">
          S
        </div>

        <div className="ml-2.5 min-w-0">
          <div className="truncate text-xs font-bold text-white">
            Invoice Automation
          </div>

          <div className="mt-0.5 text-[10px] text-slate-400">
            Admin Console
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Administration
        </p>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const isDashboard =
              item.href === "/admin";

            const isActive = isDashboard
              ? pathname === "/admin"
              : pathname === item.href ||
                pathname.startsWith(
                  `${item.href}/`
                );

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex w-full items-center rounded-lg px-2.5 py-2.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-950/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-white" />
                )}

                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "bg-slate-900 text-slate-400"
                  }`}
                >
                  {item.icon}
                </span>

                <span className="ml-2.5 truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Security Status */}
      <div className="border-t border-slate-800 p-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-[10px] font-semibold text-slate-200">
              Secure Session
            </span>
          </div>

          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
            Administrator access is protected.
          </p>
        </div>

        <div className="mt-3 px-2 text-[8px] font-semibold uppercase tracking-[0.15em] text-slate-600">
          Invoice Automation System
        </div>
      </div>
    </aside>
  );
}