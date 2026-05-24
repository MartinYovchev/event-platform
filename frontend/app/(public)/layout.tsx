import Link from "next/link";
import { CalendarHeart } from "lucide-react";

import { GuestActions, UserMenu } from "@/components/layout/user-menu";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { UserResponse } from "@/types/api";

// Public pages render with or without a session; any error from the user
// lookup (including the expected 401 for guests) yields the unauthenticated view.
async function getCurrentUser(): Promise<UserResponse | null> {
  try {
    return await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError) return null;
    throw err;
  }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <CalendarHeart className="size-4" />
            </span>
            <span className="font-heading text-base font-semibold tracking-tight text-foreground">
              EventDeck
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/events"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Browse events
            </Link>
            {me ? <UserMenu me={me} variant="topbar" /> : <GuestActions />}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-background py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} EventDeck</span>
          <span>Built with care</span>
        </div>
      </footer>
    </div>
  );
}
