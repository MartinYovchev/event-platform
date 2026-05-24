import { redirect } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { EventForm } from "@/components/events/event-form";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { UserResponse } from "@/types/api";

export default async function NewEventPage() {
  let me: UserResponse;
  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login?next=${encodeURIComponent("/dashboard/events/new")}`);
    }
    throw err;
  }

  if (!me.isOrganizer) {
    redirect("/dashboard/profile?upgrade=true");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Create event"
        description="Fill in the details. Your event will be saved as a draft so you can review it before publishing."
      />
      <EventForm mode="create" />
    </div>
  );
}
