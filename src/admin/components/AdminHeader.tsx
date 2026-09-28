"use client";

import { useState } from "react";

interface AdminUser {
  fullName?: string | null;
  email?: string | null;
}

interface AdminHeaderProps {
  user?: AdminUser | null;
}

export default function AdminHeader({
  user,
}: AdminHeaderProps) {
  const [menuOpen, setMenuOpen] =
    useState<boolean>(false);

  const displayName =
    user?.fullName || "Administrator";

  const initial =
    displayName.charAt(0).toUpperCase();

  async function handleLogout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-6">
      {/* Left */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
          Administration
        </p>

        <h1 className="mt-0.5 text-base font-semibold text-slate-900">
          Control Center
        </h1>
      </div>

      {/* Right */}
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setMenuOpen((value) => !value)
          }
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
        >
          <div className="hidden text-right sm:block">
            <p className="max-w-[180px] truncate text-xs font-semibold text-slate-900">
              {displayName}
            </p>

            <p className="max-w-[200px] truncate text-[10px] text-slate-500">
              {user?.email || "—"}
            </p>
          </div>

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            {initial}
          </div>

          <span
            className={`hidden text-[10px] text-slate-400 transition sm:block ${
              menuOpen ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-11 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 px-3.5 py-3">
              <p className="text-[11px] font-semibold text-slate-900">
                Administrator
              </p>

              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                {user?.email || "—"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}