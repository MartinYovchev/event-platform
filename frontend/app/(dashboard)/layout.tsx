import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { UserResponse } from "@/types/api";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let me: UserResponse;
  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/login?next=/dashboard");
    }
    throw err;
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar me={me} />
      <SidebarInset>
        <Topbar me={me} />
        <div className="flex-1 bg-muted/30 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
