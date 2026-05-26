import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Ticket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import type { ReservationResponse } from "@/types/api";

function formatStartAt(iso: string): string {
  try {
    return format(parseISO(iso), "EEE, MMM d • h:mm a");
  } catch {
    return iso;
  }
}

export function UpcomingReservationsTable({
  reservations,
}: {
  reservations: ReservationResponse[];
}) {
  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="No reservations yet"
        description="Reserve a spot at an event to see it here."
        action={
          <Button size="sm" nativeButton={false} render={<Link href="/events">Browse events</Link>} />
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Start</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium text-foreground">
                <Link
                  href={`/events/${r.eventId}`}
                  className="hover:text-primary"
                >
                  {r.eventTitle}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatStartAt(r.eventStartAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.quantity}
              </TableCell>
              <TableCell>
                {r.status === "ACTIVE" ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Cancelled
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/dashboard/reservations#r-${r.id}`}>
                      Manage
                    </Link>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
