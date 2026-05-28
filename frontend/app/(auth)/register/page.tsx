"use client";

import { use, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/lib/actions/auth";
import { registerSchema, type RegisterInput } from "@/lib/schemas";
import { GoogleSignInButton } from "@/components/profile/google-sign-in-button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const router = useRouter();
  const sp = use(searchParams);
  const next = firstString(sp.next) ?? "/dashboard";

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", displayName: "" },
  });

  function onSubmit(values: RegisterInput) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      if (!result.ok) {
        setSubmitError(result.error.message);
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Reserve seats and host events on EventDeck.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid gap-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              autoComplete="name"
              {...form.register("displayName")}
              maxLength={100}
              required
              aria-invalid={
                Boolean(form.formState.errors.displayName) || undefined
              }
            />
            {form.formState.errors.displayName ?
              <span className="text-xs text-destructive">
                {form.formState.errors.displayName.message}
              </span>
            : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register("email")}
              required
              aria-invalid={Boolean(form.formState.errors.email) || undefined}
            />
            {form.formState.errors.email ?
              <span className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </span>
            : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              {...form.register("password")}
              required
              aria-invalid={
                Boolean(form.formState.errors.password) || undefined
              }
            />
            {form.formState.errors.password ?
              <span className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </span>
            : <span className="text-xs text-muted-foreground">
                At least 8 characters.
              </span>
            }
          </div>

          {submitError ?
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          : null}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={pending || form.formState.isSubmitting}
          >
            {pending || form.formState.isSubmitting ?
              <Loader2 className="animate-spin" />
            : <UserPlus />}
            Create account
          </Button>
        </form>
      </CardContent>
      <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <GoogleSignInButton next={next} />
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link
          href={`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
