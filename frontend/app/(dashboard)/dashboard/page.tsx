import { formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  CalendarClock,
  CalendarRange,
  Ticket,
  Users,
} from "lucide-react";

import { redirect } from "next/navigation";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentEventsList } from "@/components/dashboard/recent-events-list";
import { UpcomingReservationsTable } from "@/components/dashboard/upcoming-reservations-table";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type {
  EventListItemResponse,
  Page,
  ReservationResponse,
  UserResponse,
} from "@/types/api";

function timeToNextEvent(reservations: ReservationResponse[]): string | null {
  let next: Date | null = null;
  for (const r of reservations) {
    if (r.status !== "ACTIVE") continue;
    try {
      const d = parseISO(r.eventStartAt);
      if (d.getTime() > Date.now() && (next === null || d < next)) {
        next = d;
      }
    } catch {
      // skip
    }
  }
  if (!next) return null;
  return formatDistanceToNowStrict(next);
}

export default async function DashboardPage() {
  let me: UserResponse | null = null;
  let reservationsPage: Page<ReservationResponse> | null = null;
  let myEventsPage: Page<EventListItemResponse> | null = null;
  let errorMessage: string | null = null;

  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login?next=${encodeURIComponent("/dashboard")}`);
    }
    if (err instanceof ApiError) {
      errorMessage = err.body.message;
    } else {
      throw err;
    }
  }

  if (!errorMessage) {
    try {
      const [resv, organizerEvents] = await Promise.all([
        serverFetch<Page<ReservationResponse>>(
          "/api/me/reservations?when=upcoming&page=0&size=5",
        ),
        me?.isOrganizer
          ? serverFetch<Page<EventListItemResponse>>(
              "/api/me/events?page=0&size=5",
            )
          : Promise.resolve(null),
      ]);
      reservationsPage = resv;
      myEventsPage = organizerEvents;
    } catch (err) {
      errorMessage =
        err instanceof ApiError
          ? err.body.message
          : "Unable to load dashboard data.";
    }
  }

  if (errorMessage) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <PageHeader title="Dashboard" />
        <ErrorState description={errorMessage} />
      </div>
    );
  }

  const upcoming = reservationsPage?.content ?? [];
  const myEvents = myEventsPage?.content ?? [];
  const nextIn = timeToNextEvent(upcoming);
  const seatsSold = myEvents.reduce((sum, e) => sum + e.seatsTaken, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title={
          me?.displayName
            ? `Welcome back, ${me.displayName.split(" ")[0]}`
            : "Dashboard"
        }
        description="Here's a quick look at what's coming up."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Upcoming reservations"
          value={(reservationsPage?.totalElements ?? 0).toLocaleString()}
          icon={Ticket}
          hint={
            upcoming.length === 0
              ? "Nothing on the calendar yet"
              : `${upcoming.length} shown`
          }
        />
        <KpiCard
          title="Next event in"
          value={nextIn ?? "—"}
          icon={CalendarClock}
          hint={nextIn ? "Until your next reservation" : "No upcoming events"}
        />
        {me?.isOrganizer ? (
          <>
            <KpiCard
              title="Organized events"
              value={(myEventsPage?.totalElements ?? 0).toLocaleString()}
              icon={CalendarRange}
              hint={`${myEvents.length} shown`}
            />
            <KpiCard
              title="Seats sold"
              value={seatsSold.toLocaleString()}
              icon={Users}
              hint="Across your recent events"
            />
          </>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Upcoming reservations
        </h2>
        <UpcomingReservationsTable reservations={upcoming} />
      </section>

      {me?.isOrganizer ? (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Recent events you organize
          </h2>
          <RecentEventsList events={myEvents} />
        </section>
      ) : null}
    </div>
  );
}
