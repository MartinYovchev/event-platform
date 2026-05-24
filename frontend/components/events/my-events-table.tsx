import Link from "next/link";
import { format, parseISO } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EventRowActions } from "@/components/events/event-row-actions";
import type { EventListItemResponse } from "@/types/api";

function formatStartAt(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy • h:mm a");
  } catch {
    return iso;
  }
}

function formatPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `$${n.toFixed(2)}`;
}

export function MyEventsTable({
  events,
}: {
  events: EventListItemResponse[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Start</TableHead>
            <TableHead className="text-right">Seats</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="w-[1%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const soldOut = event.seatsTaken >= event.capacity;
            return (
              <TableRow key={event.id}>
                <TableCell className="font-medium text-foreground">
                  <Link
                    href={`/dashboard/events/${event.id}/edit`}
                    className="hover:text-primary"
                  >
                    {event.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatStartAt(event.startAt)}
                </TableCell>
                <TableCell
                  className={
                    soldOut
                      ? "text-right font-medium text-destructive tabular-nums"
                      : "text-right tabular-nums"
                  }
                >
                  {event.seatsTaken.toLocaleString()} /{" "}
                  {event.capacity.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(event.price)}
                </TableCell>
                <TableCell className="text-right">
                  <EventRowActions
                    eventId={event.id}
                    eventTitle={event.title}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
