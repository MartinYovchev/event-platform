"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { becomeOrganizerAction } from "@/lib/actions/me";

export function BecomeOrganizerCta({ highlight = false }: { highlight?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await becomeOrganizerAction();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("You're an organizer! You can create events now.");
      router.refresh();
    });
  }

  return (
    <section
      id="become-organizer"
      className={
        "rounded-xl border-2 p-6 shadow-sm " +
        (highlight
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-primary/40 bg-primary/5")
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div className="space-y-1">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Become an organizer
            </h2>
            <p className="text-sm text-muted-foreground">
              Unlock the ability to create and manage events on EventDeck. You can
              switch on organizer mode at any time — it&apos;s free.
            </p>
          </div>
        </div>
        <Button
          onClick={onClick}
          disabled={pending}
          size="lg"
          className="shrink-0"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Enable organizer
        </Button>
      </div>
    </section>
  );
}
