"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  LayoutDashboard,
  Plus,
  Settings as SettingsIcon,
  Ticket,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import type { UserResponse } from "@/types/api";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const browseGroup: NavGroup = {
  label: "Browse",
  items: [{ href: "/events", label: "Events", icon: CalendarDays }],
};

const accountGroup: NavGroup = {
  label: "My Account",
  items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/reservations", label: "My Reservations", icon: Ticket },
  ],
};

const organizerGroup: NavGroup = {
  label: "Organizer",
  items: [
    { href: "/dashboard/events", label: "My Events", icon: CalendarRange },
    { href: "/dashboard/events/new", label: "Create Event", icon: Plus },
  ],
};

const settingsGroup: NavGroup = {
  label: "Settings",
  items: [
    { href: "/dashboard/profile", label: "Profile", icon: UserIcon },
    { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
  ],
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/events") {
    return pathname === "/dashboard/events" || pathname.startsWith("/dashboard/events/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ me }: { me: UserResponse | null }) {
  const pathname = usePathname();

  const groups: NavGroup[] = [browseGroup, accountGroup];
  if (me?.isOrganizer) groups.push(organizerGroup);
  groups.push(settingsGroup);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <Link
          href={me ? "/dashboard" : "/"}
          className="flex items-center gap-2 outline-none"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <CalendarHeart className="size-5" />
          </span>
          <span className="font-heading text-base font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            EventDeck
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-[0.7rem] font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "relative h-9 gap-3 rounded-md px-3 text-sm text-sidebar-foreground transition-colors",
                          active &&
                            "bg-sidebar-accent text-sidebar-accent-foreground font-medium before:absolute before:top-1 before:bottom-1 before:left-0 before:w-[3px] before:rounded-r before:bg-primary",
                        )}
                        render={
                          <Link href={item.href}>
                            <item.icon
                              className={cn(
                                "size-4 shrink-0",
                                active
                                  ? "text-primary"
                                  : "text-sidebar-foreground/70",
                              )}
                            />
                            <span>{item.label}</span>
                          </Link>
                        }
                      />
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <UserMenu me={me} variant="sidebar" />
      </SidebarFooter>
    </Sidebar>
  );
}
