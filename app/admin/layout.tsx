
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAdminContext();

  if (!context.authorized) {
    if (context.reason === "NOT_LOGGED_IN") {
      redirect("/login");
    }

    redirect("/");
  }

  return <>{children}</>;
}
