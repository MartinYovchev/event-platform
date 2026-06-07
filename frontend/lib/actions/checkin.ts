"use server";

import { serverFetch } from "@/lib/auth/server";
import type { CheckInView } from "@/types/api";

import { actionError, type ActionResult } from "./result";

export async function previewCheckInAction(
  eventId: number,
  token: string,
): Promise<ActionResult<CheckInView>> {
  try {
    const view = await serverFetch<CheckInView>(
      `/api/events/${eventId}/check-in/preview?token=${encodeURIComponent(token)}`,
    );
    return { ok: true, data: view };
  } catch (err) {
    return actionError(err, "Could not read this QR code.");
  }
}

export async function confirmCheckInAction(
  eventId: number,
  token: string,
): Promise<ActionResult<CheckInView>> {
  try {
    const view = await serverFetch<CheckInView>(
      `/api/events/${eventId}/check-in`,
      { method: "POST", body: JSON.stringify({ token }) },
    );
    return { ok: true, data: view };
  } catch (err) {
    return actionError(err, "Could not check in this attendee.");
  }
}
