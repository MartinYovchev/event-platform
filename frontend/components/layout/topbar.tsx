"use client";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import type { UserResponse } from "@/types/api";

type TopbarProps = {
  me: UserResponse | null;
  children?: React.ReactNode;
};

export function Topbar({ me, children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="md:flex" />
      <Separator orientation="vertical" className="hidden h-5 md:block" />
      <div className="flex min-w-0 flex-1 items-center">
        {children ?? <span className="sr-only">EventDeck</span>}
      </div>
      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notifications"
                className="relative"
              >
                <Bell className="size-4" />
              </Button>
            }
          />
          <PopoverContent align="end" sideOffset={8} className="w-72 p-0">
            <div className="border-b px-3 py-2 text-sm font-medium">
              Notifications
            </div>
            <div className="flex flex-col items-center gap-1 px-4 py-6 text-center text-sm text-muted-foreground">
              <Bell className="size-5 text-muted-foreground/60" />
              <span>No notifications</span>
            </div>
          </PopoverContent>
        </Popover>
        <UserMenu me={me} variant="topbar" />
      </div>
    </header>
  );
}
