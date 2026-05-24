import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { ReservationsTabs } from "@/components/reservations/reservations-tabs";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { Page, ReservationResponse } from "@/types/api";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const whenParam = firstString(raw.when);
  const when: "upcoming" | "past" = whenParam === "past" ? "past" : "upcoming";

  let data: Page<ReservationResponse> | null = null;
  let errorMessage: string | null = null;

  try {
    data = await serverFetch<Page<ReservationResponse>>(
      `/api/me/reservations?when=${when}&page=0&size=20`,
    );
  } catch (err) {
    errorMessage =
      err instanceof ApiError
        ? err.body.message
        : "Unable to load reservations.";
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="My reservations"
        description="View and manage your event reservations."
      />
      {errorMessage ? (
        <ErrorState description={errorMessage} />
      ) : (
        <ReservationsTabs
          when={when}
          reservations={data?.content ?? []}
        />
      )}
    </div>
  );
}
