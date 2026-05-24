import Link from "next/link";
import { format, parseISO } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { CancelReservationButton } from "@/components/reservations/cancel-reservation-button";
import { CutoffCountdown } from "@/components/reservations/cutoff-countdown";
import type { ReservationResponse } from "@/types/api";

function formatStartAt(iso: string): string {
  try {
    return format(parseISO(iso), "EEE, MMM d • h:mm a");
  } catch {
    return iso;
  }
}

export function ReservationRow({
  reservation,
  showActions,
}: {
  reservation: ReservationResponse;
  showActions: boolean;
}) {
  const isActive = reservation.status === "ACTIVE";
  const startInPast = (() => {
    try {
      return new Date(reservation.eventStartAt).getTime() <= Date.now();
    } catch {
      return false;
    }
  })();

  return (
    <TableRow id={`r-${reservation.id}`}>
      <TableCell className="font-medium text-foreground">
        <Link
          href={`/events/${reservation.eventId}`}
          className="hover:text-primary"
        >
          {reservation.eventTitle}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">
        <div className="flex flex-col">
          <span>{formatStartAt(reservation.eventStartAt)}</span>
          {showActions && isActive && !startInPast ? (
            <CutoffCountdown eventStartAt={reservation.eventStartAt} />
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {reservation.quantity}
      </TableCell>
      <TableCell>
        {isActive ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Cancelled
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        {showActions && isActive && !startInPast ? (
          <CancelReservationButton
            reservationId={reservation.id}
            eventId={reservation.eventId}
            eventTitle={reservation.eventTitle}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
