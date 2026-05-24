"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "ALL";

export function MyEventsStatusFilter() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("status") || ALL;

  function onChange(value: string | number | null) {
    const next = String(value);
    const params = new URLSearchParams(sp.toString());
    params.delete("page");
    if (next === ALL) params.delete("status");
    else params.set("status", next);
    const qs = params.toString();
    router.replace(qs ? `/dashboard/events?${qs}` : "/dashboard/events");
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All statuses</SelectItem>
        <SelectItem value="DRAFT">Draft</SelectItem>
        <SelectItem value="PUBLISHED">Published</SelectItem>
        <SelectItem value="CANCELLED">Cancelled</SelectItem>
      </SelectContent>
    </Select>
  );
}
