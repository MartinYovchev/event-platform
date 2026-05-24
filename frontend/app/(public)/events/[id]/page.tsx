import { format, parseISO } from "date-fns";
import { CalendarDays, MapPin, User as UserIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { EventStatusBadge } from "@/components/events/event-status-badge";
import { ReserveWidget } from "@/components/reservations/reserve-widget";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { EventResponse, UserResponse } from "@/types/api";

type EventPageProps = {
  params: Promise<{ id: string }>;
};

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
      return `${format(start, "EEEE, MMMM d, yyyy • h:mm a")} – ${format(end, "h:mm a")}`;
    }
    return `${format(start, "MMM d, yyyy • h:mm a")} – ${format(end, "MMM d, yyyy • h:mm a")}`;
  } catch {
    return startIso;
  }
}

export default async function EventDetailPage({ params }: EventPageProps) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id <= 0) {
    notFound();
  }

  let event: EventResponse;
  try {
    event = await serverFetch<EventResponse>(`/api/events/${id}`, {
      auth: false,
      next: { revalidate: 30 },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  let me: UserResponse | null = null;
  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }

  return (
    <article className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted sm:aspect-[3/1]">
          {event.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.coverImageUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-full items-center justify-center bg-gradient-to-br from-primary/80 to-muted"
            >
              <span className="font-heading text-7xl font-semibold text-primary-foreground/90 drop-shadow-sm sm:text-8xl">
                {initialOf(event.title)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <EventStatusBadge status={event.status} />
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {event.title}
          </h1>

          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2 text-sm text-foreground">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="sr-only">When</dt>
                <dd>{formatRange(event.startAt, event.endAt)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="sr-only">Where</dt>
                <dd>{event.location}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-foreground">
              <UserIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="sr-only">Organizer</dt>
                <dd>
                  Hosted by{" "}
                  <span className="font-medium">{event.organizerDisplayName}</span>
                </dd>
              </div>
            </div>
          </dl>

          <section className="mt-8">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              About this event
            </h2>
            <div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {event.description}
            </div>
          </section>
        </div>

        <ReserveWidget event={event} me={me} />
      </div>
    </article>
  );
}
