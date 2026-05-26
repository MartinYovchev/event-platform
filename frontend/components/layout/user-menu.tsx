"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { LogOut, Settings as SettingsIcon, User as UserIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";
import type { UserResponse } from "@/types/api";

type UserMenuProps = {
  me: UserResponse | null;
  variant?: "sidebar" | "topbar";
};

function initialsOf(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function UserMenu({ me, variant = "topbar" }: UserMenuProps) {
  const router = useRouter();
  const [loggingOut, startTransition] = useTransition();

  function handleSignOut() {
    if (loggingOut) return;
    startTransition(async () => {
      await logoutAction();
      router.push("/login");
      router.refresh();
    });
  }

  if (!me) {
    if (variant === "sidebar") {
      return (
        <div className="flex items-center gap-2 rounded-md p-2 text-xs text-sidebar-foreground/70">
          Not signed in
        </div>
      );
    }
    return null;
  }

  const initials = initialsOf(me.displayName);
  const triggerClasses =
    variant === "sidebar"
      ? "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      : "flex items-center gap-2 rounded-full px-1 text-sm hover:bg-muted";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={triggerClasses}>
            <Avatar size={variant === "sidebar" ? "default" : "default"}>
              <AvatarFallback className="bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {variant === "sidebar" && (
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{me.displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {me.email}
                </span>
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {me.displayName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {me.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link href="/dashboard/profile">
              <UserIcon />
              Profile
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <Link href="/dashboard/settings">
              <SettingsIcon />
              Settings
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={handleSignOut}
          disabled={loggingOut}
        >
          <LogOut />
          {loggingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Convenience wrapper for unauthenticated CTAs.
export function GuestActions() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login">Sign in</Link>} />
      <Button size="sm" nativeButton={false} render={<Link href="/register">Register</Link>} />
    </div>
  );
}
