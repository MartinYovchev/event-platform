"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function toIsoDayStart(date: Date): string {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
  );
  return utc.toISOString();
}

function toIsoDayEnd(date: Date): string {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999),
  );
  return utc.toISOString();
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}

function DatePickerField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 justify-start gap-2 px-3 text-left font-normal",
              !value && "text-muted-foreground",
            )}
            aria-label={label}
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span className="flex-1 truncate">
              {value ? format(value, "MMM d, yyyy") : placeholder}
            </span>
            {value ? (
              <span
                role="button"
                aria-label={`Clear ${label}`}
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(undefined);
                }}
              >
                <X className="size-3.5" />
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => onChange(d ?? undefined)}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function EventFilterBar() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialSearch = sp.get("search") ?? "";
  const initialFrom = useMemo(() => parseDateParam(sp.get("from")), [sp]);
  const initialTo = useMemo(() => parseDateParam(sp.get("to")), [sp]);

  const [searchText, setSearchText] = useState(initialSearch);
  const [from, setFrom] = useState<Date | undefined>(initialFrom);
  const [to, setTo] = useState<Date | undefined>(initialTo);

  // Keep local state synced if user navigates back/forward.
  const lastSyncRef = useRef<string>(initialSearch);
  useEffect(() => {
    const current = sp.get("search") ?? "";
    if (current !== lastSyncRef.current) {
      setSearchText(current);
      lastSyncRef.current = current;
    }
  }, [sp]);

  const pushQuery = useCallback(
    (next: { search?: string; from?: Date; to?: Date }) => {
      const params = new URLSearchParams(sp.toString());
      // Always reset page when filters change.
      params.delete("page");

      if (next.search !== undefined) {
        if (next.search.trim()) params.set("search", next.search.trim());
        else params.delete("search");
      }
      if ("from" in next) {
        if (next.from) params.set("from", toIsoDayStart(next.from));
        else params.delete("from");
      }
      if ("to" in next) {
        if (next.to) params.set("to", toIsoDayEnd(next.to));
        else params.delete("to");
      }

      const qs = params.toString();
      router.replace(qs ? `/events?${qs}` : "/events");
    },
    [router, sp],
  );

  // Debounce search input.
  useEffect(() => {
    if (searchText === (sp.get("search") ?? "")) return;
    const handle = setTimeout(() => {
      lastSyncRef.current = searchText;
      pushQuery({ search: searchText });
    }, 350);
    return () => clearTimeout(handle);
  }, [searchText, sp, pushQuery]);

  const hasAnyFilter = Boolean(searchText || from || to);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        lastSyncRef.current = searchText;
        pushQuery({ search: searchText, from, to });
      }}
      className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search events by title or location…"
          className="h-9 pl-9"
          aria-label="Search events"
        />
      </div>
      <DatePickerField
        label="From date"
        value={from}
        onChange={(d) => {
          setFrom(d);
          pushQuery({ from: d });
        }}
        placeholder="From"
      />
      <DatePickerField
        label="To date"
        value={to}
        onChange={(d) => {
          setTo(d);
          pushQuery({ to: d });
        }}
        placeholder="To"
      />
      {hasAnyFilter ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchText("");
            setFrom(undefined);
            setTo(undefined);
            lastSyncRef.current = "";
            router.replace("/events");
          }}
        >
          Clear
        </Button>
      ) : null}
    </form>
  );
}
