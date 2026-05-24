"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReservationRow } from "@/components/reservations/reservation-row";
import type { ReservationResponse } from "@/types/api";

type When = "upcoming" | "past";

type ReservationsTabsProps = {
  when: When;
  reservations: ReservationResponse[];
};

export function ReservationsTabs({ when, reservations }: ReservationsTabsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleChange(value: string | number | null) {
    const next = String(value) === "past" ? "past" : "upcoming";
    if (next === when) return;
    startTransition(() => {
      router.replace(`/dashboard/reservations?when=${next}`);
    });
  }

  return (
    <Tabs value={when} onValueChange={handleChange}>
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        <TabsTrigger value="past">Past</TabsTrigger>
      </TabsList>
      <TabsContent value={when} className="mt-4">
        {reservations.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={
              when === "upcoming"
                ? "No upcoming reservations"
                : "No past reservations"
            }
            description={
              when === "upcoming"
                ? "Browse events and reserve a spot."
                : "Reservations move here after their event ends."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <ReservationRow
                    key={r.id}
                    reservation={r}
                    showActions={when === "upcoming"}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
