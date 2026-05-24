"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type EventPaginationProps = {
  page: number;
  totalPages: number;
  basePath?: string;
};

function buildPageNumbers(current: number, total: number): Array<number | "..."> {
  // Pages are 0-indexed in our state but rendered 1-indexed.
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const result: Array<number | "..."> = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  if (start > 1) result.push("...");
  for (let i = start; i <= end; i++) result.push(i);
  if (end < total - 2) result.push("...");
  result.push(total - 1);
  return result;
}

export function EventPagination({
  page,
  totalPages,
  basePath = "/events",
}: EventPaginationProps) {
  const sp = useSearchParams();

  const hrefFor = useMemo(() => {
    return (targetPage: number) => {
      const params = new URLSearchParams(sp.toString());
      if (targetPage <= 0) params.delete("page");
      else params.set("page", String(targetPage));
      const qs = params.toString();
      return qs ? `${basePath}?${qs}` : basePath;
    };
  }, [sp, basePath]);

  if (totalPages <= 1) return null;

  const items = buildPageNumbers(page, totalPages);
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  return (
    <Pagination className="mt-6">
      <PaginationContent>
        <PaginationItem>
          {hasPrev ? (
            <PaginationPrevious href={hrefFor(page - 1)} />
          ) : (
            <PaginationPrevious
              href="#"
              aria-disabled
              className="pointer-events-none opacity-40"
            />
          )}
        </PaginationItem>

        {items.map((item, idx) =>
          item === "..." ? (
            <PaginationItem key={`e-${idx}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink href={hrefFor(item)} isActive={item === page}>
                {item + 1}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          {hasNext ? (
            <PaginationNext href={hrefFor(page + 1)} />
          ) : (
            <PaginationNext
              href="#"
              aria-disabled
              className="pointer-events-none opacity-40"
            />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
