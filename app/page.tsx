import { redirect } from "next/navigation";

import App from "@/src/App";
import { getAuthenticatedUser } from "@/src/auth/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "ADMIN") {
    redirect("/admin");
  }

  return <App />;
}