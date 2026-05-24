import Link from "next/link";
import { CalendarHeart } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 text-foreground"
        aria-label="EventDeck home"
      >
        <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <CalendarHeart className="size-5" />
        </span>
        <span className="font-heading text-lg font-semibold tracking-tight">
          EventDeck
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
