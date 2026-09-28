"use client";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void | Promise<void>;
}

interface NavigationItem {
  label: string;
  page: string;
  icon: string;
}

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    page: "dashboard",
    icon: "▦",
  },
  {
    label: "Summary",
    page: "summary",
    icon: "◫",
  },
  {
    label: "Invoice Processing",
    page: "processing",
    icon: "▤",
  },
  {
    label: "History",
    page: "history",
    icon: "◷",
  },
];

function Sidebar({
  currentPage,
  onNavigate,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-slate-950 text-white">
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
            Invoice Console
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Workspace
        </p>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              currentPage === item.page;

            return (
              <button
                key={item.page}
                type="button"
                onClick={() =>
                  onNavigate(item.page)
                }
                className={`relative flex w-full items-center rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold transition-colors ${
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
              </button>
            );
          })}
        </nav>
      </div>

      {/* Security / Logout */}
      <div className="border-t border-slate-800 p-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-[10px] font-semibold text-slate-200">
              Secure Session
            </span>
          </div>

          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
            Your invoice workspace is protected.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-2.5 flex w-full items-center rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold text-slate-300 transition-colors hover:bg-red-950/40 hover:text-red-300"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs text-slate-400">
            ↪
          </span>

          <span className="ml-2.5">
            Logout
          </span>
        </button>

        <div className="mt-3 px-2 text-[8px] font-semibold uppercase tracking-[0.15em] text-slate-600">
          Invoice Automation System
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;