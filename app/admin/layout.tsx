import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/src/auth/auth";
import AdminLayout from "@/src/admin/layout/AdminLayout";

import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

interface AdminRootLayoutProps {
  children: ReactNode;
}

export default async function AdminRootLayout({
  children,
}: AdminRootLayoutProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AdminLayout user={user}>
      {children}
    </AdminLayout>
  );
}