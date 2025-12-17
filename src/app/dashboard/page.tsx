import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import DashboardClient from "./ui";

export const dynamic = "force-dynamic";

function devAdminEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_AUTH === "1";
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const devAdmin = devAdminEnabled() && cookieStore.get("dev_admin")?.value === "1";
  if (devAdmin) {
    return <DashboardClient email="admin@local" />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <DashboardClient email={user.email ?? ""} />;
}
