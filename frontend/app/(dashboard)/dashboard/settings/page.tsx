import { redirect } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { DeleteAccountDialog } from "@/components/profile/delete-account-dialog";
import { serverFetch } from "@/lib/auth/server";
import { ApiError } from "@/lib/errors";
import type { UserResponse } from "@/types/api";

export default async function SettingsPage() {
  let me: UserResponse;
  try {
    me = await serverFetch<UserResponse>("/api/users/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login?next=${encodeURIComponent("/dashboard/settings")}`);
    }
    throw err;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account."
      />

      <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="font-heading text-lg font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="text-sm text-muted-foreground">
            Deleting your account is permanent and irreversible.
          </p>
        </header>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            Permanently delete your account, reservations, and organized events.
          </p>
          <DeleteAccountDialog email={me.email} />
        </div>
      </section>
    </div>
  );
}
