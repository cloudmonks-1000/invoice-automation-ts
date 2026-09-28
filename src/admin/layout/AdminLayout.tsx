import AdminSidebar from "@/src/admin/components/AdminSidebar";
import AdminHeader from "@/src/admin/components/AdminHeader";
import type { ReactNode } from "react";

interface AdminUser {
  fullName?: string | null;
  email?: string | null;
}

interface AdminLayoutProps {
  user?: AdminUser | null;
  children: ReactNode;
}

export default function AdminLayout({
  user,
  children,
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Area */}
      <div className="min-h-screen pl-60">
        {/* Header */}
        <AdminHeader user={user} />

        {/* Content */}
        <main className="min-h-[calc(100vh-4rem)] p-6 lg:p-7">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}