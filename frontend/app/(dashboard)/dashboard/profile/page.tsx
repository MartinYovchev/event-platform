import { redirect } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { BecomeOrganizerCta } from "@/components/profile/become-organizer-cta";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { UserResponse } from "@/types/api";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let me: UserResponse;
  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login?next=${encodeURIComponent("/dashboard/profile")}`);
    }
    throw err;
  }

  const raw = await searchParams;
  const highlightUpgrade =
    firstString(raw.upgrade) === "true" && !me.isOrganizer;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Profile"
        description="Account details and credentials."
      />

      {!me.isOrganizer ? <BecomeOrganizerCta highlight={highlightUpgrade} /> : null}

      <ProfileForm initial={me} />
      <ChangePasswordForm />
    </div>
  );
}
