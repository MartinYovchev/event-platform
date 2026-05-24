import { notFound, redirect } from "next/navigation";

import { EventStatusBadge } from "@/components/events/event-status-badge";
import { CancelEventButton } from "@/components/events/cancel-event-button";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/common/page-header";
import { PublishButton } from "@/components/events/publish-button";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { EventResponse, UserResponse } from "@/types/api";

type Props = { params: Promise<{ id: string }> };

export default async function EditEventPage({ params }: Props) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();

  let me: UserResponse;
  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(
        `/login?next=${encodeURIComponent(`/dashboard/events/${id}/edit`)}`,
      );
    }
    throw err;
  }
  if (!me.isOrganizer) redirect("/dashboard/profile?upgrade=true");

  let event: EventResponse;
  try {
    event = await serverFetch<EventResponse>(`/api/events/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Edit event"
        description={
          <span className="flex items-center gap-2">
            <EventStatusBadge status={event.status} />
            <span>{event.title}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PublishButton eventId={event.id} status={event.status} />
            <CancelEventButton eventId={event.id} status={event.status} />
            <DeleteEventButton eventId={event.id} status={event.status} />
          </div>
        }
      />

      <EventForm mode="edit" initial={event} status={event.status} />
    </div>
  );
}
