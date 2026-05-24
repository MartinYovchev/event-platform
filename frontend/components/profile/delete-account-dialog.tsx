"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccountAction } from "@/lib/actions/me";

export function DeleteAccountDialog({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const canDelete = confirmText.trim().toLowerCase() === email.toLowerCase();

  function onConfirm() {
    if (!canDelete) return;
    startTransition(async () => {
      const result = await deleteAccountAction();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Account deleted.");
      router.push("/");
      router.refresh();
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmText("");
    setOpen(next);
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 />
        Delete account
      </Button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your account, reservations, and any events
              you organize. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="confirmEmail">
              Type your email <span className="font-mono">{email}</span> to confirm
            </Label>
            <Input
              id="confirmEmail"
              type="email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              placeholder={email}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!canDelete || pending}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
