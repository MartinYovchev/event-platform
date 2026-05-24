"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/lib/actions/me";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/schemas";
import type { UserResponse } from "@/types/api";

export function ProfileForm({ initial }: { initial: UserResponse }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: initial.displayName },
  });

  function onSubmit(values: UpdateProfileInput) {
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Profile updated.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Profile
        </h2>
        <p className="text-sm text-muted-foreground">
          Update how your name appears across EventDeck.
        </p>
      </header>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={initial.email} disabled readOnly />
          <span className="text-xs text-muted-foreground">
            Your email can&apos;t be changed.
          </span>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            {...form.register("displayName")}
            maxLength={100}
            required
            aria-invalid={Boolean(form.formState.errors.displayName) || undefined}
          />
          {form.formState.errors.displayName ? (
            <span className="text-xs text-destructive">
              {form.formState.errors.displayName.message}
            </span>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </form>
    </section>
  );
}
