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
import { changePasswordAction } from "@/lib/actions/me";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas";

export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: "", newPassword: "" },
  });

  function onSubmit(values: ChangePasswordInput) {
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Password changed. Please sign in again.");
      router.push("/login?reason=password_changed");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Change password
        </h2>
        <p className="text-sm text-muted-foreground">
          You&apos;ll be signed out and asked to sign in with your new password.
        </p>
      </header>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-1.5">
          <Label htmlFor="oldPassword">Current password</Label>
          <Input
            id="oldPassword"
            type="password"
            autoComplete="current-password"
            {...form.register("oldPassword")}
            required
            aria-invalid={Boolean(form.formState.errors.oldPassword) || undefined}
          />
          {form.formState.errors.oldPassword ? (
            <span className="text-xs text-destructive">
              {form.formState.errors.oldPassword.message}
            </span>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            {...form.register("newPassword")}
            required
            aria-invalid={Boolean(form.formState.errors.newPassword) || undefined}
          />
          {form.formState.errors.newPassword ? (
            <span className="text-xs text-destructive">
              {form.formState.errors.newPassword.message}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Must be at least 8 characters.
            </span>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}
