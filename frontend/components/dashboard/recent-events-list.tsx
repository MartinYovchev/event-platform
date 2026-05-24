import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import type { EventListItemResponse } from "@/types/api";

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy • h:mm a");
  } catch {
    return iso;
  }
}

function seatsLabel(taken: number, capacity: number): string {
  return `${taken.toLocaleString()} / ${capacity.toLocaleString()} seats`;
}

function colorFromId(id: number): string {
  const hue = (id * 47) % 360;
  return `oklch(0.7 0.12 ${hue})`;
}

export function RecentEventsList({
  events,
}: {
  events: EventListItemResponse[];
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No events to show"
        description="Create your first event to start filling seats."
        action={
          <Button
            size="sm"
            render={<Link href="/dashboard/events/new">Create event</Link>}
          />
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
      {events.map((event) => {
        const soldOut = event.seatsTaken >= event.capacity;
        return (
          <li
            key={event.id}
            className="flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/30"
          >
            {event.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.coverImageUrl}
                alt=""
                className="size-12 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="size-12 shrink-0 rounded-md"
                style={{ backgroundColor: colorFromId(event.id) }}
              />
            )}
            <div className="min-w-0 flex-1">
              <Link
                href={`/events/${event.id}`}
                className="block truncate font-medium text-foreground hover:text-primary"
              >
                {event.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>{formatDate(event.startAt)}</span>
                <span className="text-border">•</span>
                <span className={soldOut ? "text-destructive" : undefined}>
                  {seatsLabel(event.seatsTaken, event.capacity)}
                </span>
              </div>
            </div>
            <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
              ${event.price}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
