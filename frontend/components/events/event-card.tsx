import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EventListItemResponse } from "@/types/api";

function initialOf(title: string): string {
  const first = title.trim()[0];
  return first ? first.toUpperCase() : "?";
}

function formatRange(startIso: string, endIso: string): string {
  try {
    const start = parseISO(startIso);
    const end = parseISO(endIso);
    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    if (sameDay) {
      return `${format(start, "EEE, MMM d • h:mm a")} – ${format(end, "h:mm a")}`;
    }
    return `${format(start, "MMM d, h:mm a")} – ${format(end, "MMM d, h:mm a")}`;
  } catch {
    return startIso;
  }
}

function formatPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `$${n.toFixed(2)}`;
}

export function EventCard({ event }: { event: EventListItemResponse }) {
  const soldOut = event.seatsTaken >= event.capacity;
  const seatsLeft = Math.max(0, event.capacity - event.seatsTaken);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div
            aria-hidden
            className="flex size-full items-center justify-center bg-gradient-to-br from-primary/80 to-muted"
          >
            <span className="font-heading text-5xl font-semibold text-primary-foreground/90 drop-shadow-sm">
              {initialOf(event.title)}
            </span>
          </div>
        )}
        <div className="absolute top-2 right-2 rounded-md bg-background/90 px-2 py-1 text-xs font-semibold tabular-nums shadow-sm">
          {formatPrice(event.price)}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading line-clamp-2 text-base font-semibold leading-snug text-foreground group-hover:text-primary">
          {event.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" />
          <span className="truncate">{formatRange(event.startAt, event.endAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{event.location}</span>
        </div>
        <div className="mt-auto pt-2 text-xs">
          <span
            className={cn(
              "tabular-nums",
              soldOut ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {soldOut
              ? "Sold out"
              : `${seatsLeft.toLocaleString()} / ${event.capacity.toLocaleString()} seats left`}
          </span>
        </div>
      </div>
    </Link>
  );
}
