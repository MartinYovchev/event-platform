import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { MyEventsStatusFilter } from "@/components/events/my-events-status-filter";
import { MyEventsTable } from "@/components/events/my-events-table";
import { EventPagination } from "@/components/events/event-pagination";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type {
  EventListItemResponse,
  EventStatus,
  Page,
  UserResponse,
} from "@/types/api";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUSES: ReadonlyArray<EventStatus> = ["DRAFT", "PUBLISHED", "CANCELLED"];

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parsePage(v: string | undefined): number {
  if (!v) return 0;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default async function MyEventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let me: UserResponse;
  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login?next=${encodeURIComponent("/dashboard/events")}`);
    }
    throw err;
  }

  if (!me.isOrganizer) {
    redirect("/dashboard/profile?upgrade=true");
  }

  const raw = await searchParams;
  const statusRaw = firstString(raw.status);
  const status: EventStatus | undefined = STATUSES.includes(
    statusRaw as EventStatus,
  )
    ? (statusRaw as EventStatus)
    : undefined;
  const page = parsePage(firstString(raw.page));

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  qs.set("page", String(page));
  qs.set("size", "20");

  let data: Page<EventListItemResponse> | null = null;
  let errorMessage: string | null = null;

  try {
    data = await serverFetch<Page<EventListItemResponse>>(
      `/api/me/events?${qs.toString()}`,
    );
  } catch (err) {
    errorMessage =
      err instanceof ApiError ? err.body.message : "Unable to load your events.";
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="My events"
        description="Manage events you organize."
        actions={
          <Button
            nativeButton={false}
            render={
              <Link href="/dashboard/events/new">
                <Plus />
                New event
              </Link>
            }
          />
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <MyEventsStatusFilter />
      </div>

      {errorMessage ? (
        <ErrorState description={errorMessage} />
      ) : !data || data.content.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={status ? `No ${status.toLowerCase()} events` : "No events yet"}
          description={
            status
              ? "Try a different filter or create a new event."
              : "Create your first event to start filling seats."
          }
          action={
            <Button
              nativeButton={false}
              render={
                <Link href="/dashboard/events/new">
                  <Plus />
                  Create event
                </Link>
              }
            />
          }
        />
      ) : (
        <>
          <MyEventsTable events={data.content} />
          <EventPagination
            page={data.number}
            totalPages={data.totalPages}
            basePath="/dashboard/events"
          />
        </>
      )}
    </div>
  );
}
