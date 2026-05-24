import { CalendarSearch } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { EventCard } from "@/components/events/event-card";
import { EventFilterBar } from "@/components/events/event-filter-bar";
import { EventPagination } from "@/components/events/event-pagination";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { EventListItemResponse, Page } from "@/types/api";

const DEFAULT_PAGE_SIZE = 12;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseIntOr(value: string | undefined, fallback: number, min: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const search = firstString(raw.search)?.trim() || undefined;
  const from = firstString(raw.from) || undefined;
  const to = firstString(raw.to) || undefined;
  const page = parseIntOr(firstString(raw.page), 0, 0);
  const size = parseIntOr(firstString(raw.size), DEFAULT_PAGE_SIZE, 1);

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  qs.set("page", String(page));
  qs.set("size", String(size));

  let data: Page<EventListItemResponse> | null = null;
  let errorMessage: string | null = null;

  try {
    data = await serverFetch<Page<EventListItemResponse>>(
      `/api/events?${qs.toString()}`,
      { auth: false, next: { revalidate: 30 } },
    );
  } catch (err) {
    errorMessage =
      err instanceof ApiError
        ? err.body.message
        : "Unable to load events. Please try again.";
  }

  const description =
    data && data.totalElements > 0
      ? `${data.totalElements.toLocaleString()} ${data.totalElements === 1 ? "event" : "events"} found.`
      : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader title="Upcoming events" description={description} />
      <EventFilterBar />

      {errorMessage ? (
        <ErrorState description={errorMessage} />
      ) : !data || data.content.length === 0 ? (
        <EmptyState
          icon={CalendarSearch}
          title="No events found"
          description={
            search || from || to
              ? "Try adjusting your filters."
              : "Check back soon — new events are added all the time."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.content.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          <EventPagination page={data.number} totalPages={data.totalPages} />
        </>
      )}
    </div>
  );
}
