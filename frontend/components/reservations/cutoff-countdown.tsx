"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";

export function CutoffCountdown({ eventStartAt }: { eventStartAt: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handle = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(handle);
  }, []);

  let start: Date;
  try {
    start = parseISO(eventStartAt);
  } catch {
    return null;
  }

  if (start.getTime() <= Date.now()) {
    return (
      <span className="text-xs text-muted-foreground">Cutoff passed</span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      Starts in {formatDistanceToNowStrict(start)}
    </span>
  );
}
