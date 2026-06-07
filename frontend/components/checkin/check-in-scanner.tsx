"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { format, parseISO } from "date-fns";
import {
  CalendarX2,
  CameraOff,
  CheckCircle2,
  Loader2,
  ScanLine,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { IDetectedBarcode, IScannerError } from "@yudiel/react-qr-scanner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  confirmCheckInAction,
  previewCheckInAction,
} from "@/lib/actions/checkin";
import type { CheckInView } from "@/types/api";

// The Scanner touches browser-only camera APIs; never render it on the server.
const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((m) => m.Scanner),
  { ssr: false },
);

type Phase = "scanning" | "previewing" | "review" | "confirming" | "done";

function formatCheckedInAt(iso: string): string {
  try {
    return format(parseISO(iso), "EEE, MMM d • h:mm a");
  } catch {
    return iso;
  }
}

export function CheckInScanner({ eventId }: { eventId: number }) {
  const [phase, setPhase] = useState<Phase>("scanning");
  const [view, setView] = useState<CheckInView | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function reset() {
    setView(null);
    setToken(null);
    setPhase("scanning");
  }

  function onScan(codes: IDetectedBarcode[]) {
    // Ignore detections that arrive while we're already handling one.
    if (phase !== "scanning") return;
    const raw = codes[0]?.rawValue?.trim();
    if (!raw) return;

    setToken(raw);
    setPhase("previewing");
    startTransition(async () => {
      const result = await previewCheckInAction(eventId, raw);
      if (!result.ok) {
        toast.error(result.error.message);
        reset();
        return;
      }
      setView(result.data);
      setPhase("review");
    });
  }

  function onCameraError(error: IScannerError) {
    const friendly: Record<string, string> = {
      "permission-denied":
        "Camera permission was denied. Allow camera access and reload.",
      "no-camera": "No camera was found on this device.",
      "insecure-context":
        "Camera access requires HTTPS (or localhost in development).",
      unsupported: "This browser doesn't support camera scanning.",
      "in-use": "The camera is being used by another app.",
    };
    setCameraError(friendly[error.kind] ?? "Couldn't start the camera.");
  }

  function confirm() {
    if (!token) return;
    setPhase("confirming");
    startTransition(async () => {
      const result = await confirmCheckInAction(eventId, token);
      if (!result.ok) {
        toast.error(result.error.message);
        setPhase("review");
        return;
      }
      setView(result.data);
      setPhase("done");
      toast.success(`${result.data.name} checked in.`);
    });
  }

  if (cameraError) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <CameraOff className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{cameraError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto grid max-w-md gap-4">
      <Card className="overflow-hidden">
        <div className="relative aspect-square bg-black">
          <Scanner
            onScan={onScan}
            onError={onCameraError}
            formats={["qr_code"]}
            paused={phase !== "scanning"}
            scanDelay={500}
            styles={{
              container: { width: "100%", height: "100%" },
              video: { width: "100%", height: "100%", objectFit: "cover" },
            }}
          />
          {phase === "previewing" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : null}
        </div>
      </Card>

      {phase === "scanning" || phase === "previewing" ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ScanLine className="size-4" />
          Point the camera at an attendee&apos;s ticket QR code.
        </p>
      ) : null}

      {view && (phase === "review" || phase === "confirming" || phase === "done") ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="truncate">{view.name || "Attendee"}</span>
              {phase === "done" ? (
                <Badge variant="default">
                  <CheckCircle2 />
                  Checked in
                </Badge>
              ) : view.attended ? (
                <Badge variant="destructive">Already checked in</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <div className="truncate">{view.email}</div>
            <div>
              {view.quantity} {view.quantity === 1 ? "ticket" : "tickets"}
            </div>
            {view.attended && view.checkedInAt ? (
              <div className="flex items-center gap-1.5 text-destructive">
                <CalendarX2 className="size-3.5" />
                Scanned {formatCheckedInAt(view.checkedInAt)}
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="gap-2">
            {phase === "done" ? (
              <Button onClick={reset} className="w-full">
                <ScanLine />
                Scan next
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={reset}
                  disabled={phase === "confirming"}
                  className="flex-1"
                >
                  Scan next
                </Button>
                <Button
                  onClick={confirm}
                  disabled={phase === "confirming" || view.attended}
                  className="flex-1"
                >
                  {phase === "confirming" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <UserCheck />
                  )}
                  {view.attended ? "Already in" : "Confirm check-in"}
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
