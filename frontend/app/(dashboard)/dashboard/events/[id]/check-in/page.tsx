import { notFound, redirect } from "next/navigation";

import { CheckInScanner } from "@/components/checkin/check-in-scanner";
import { PageHeader } from "@/components/common/page-header";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { EventResponse, UserResponse } from "@/types/api";

type Props = { params: Promise<{ id: string }> };

export default async function CheckInPage({ params }: Props) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();

  let me: UserResponse;
  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(
        `/login?next=${encodeURIComponent(`/dashboard/events/${id}/check-in`)}`,
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
      <PageHeader title="Check in" description={event.title} />
      <CheckInScanner eventId={event.id} />
    </div>
  );
}
