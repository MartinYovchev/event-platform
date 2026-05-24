"use client";

import { use, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, LogIn } from "lucide-react";

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
import { loginAction } from "@/lib/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/schemas";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const router = useRouter();
  const sp = use(searchParams);
  const next = firstString(sp.next) ?? "/dashboard";
  const reason = firstString(sp.reason);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginInput) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await loginAction(values);
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
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Use your email and password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reason === "expired" ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Session expired. Please sign in again.</span>
          </div>
        ) : reason === "password_changed" ? (
          <div
            role="status"
            className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground"
          >
            Password updated. Sign in with your new credentials.
          </div>
        ) : null}

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
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
            {form.formState.errors.email ? (
              <span className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </span>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
              required
              aria-invalid={Boolean(form.formState.errors.password) || undefined}
            />
            {form.formState.errors.password ? (
              <span className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </span>
            ) : null}
          </div>

          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={pending || form.formState.isSubmitting}
          >
            {pending || form.formState.isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <LogIn />
            )}
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Don&apos;t have an account?&nbsp;
        <Link
          href={`/register${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          Register
        </Link>
      </CardFooter>
    </Card>
  );
}
