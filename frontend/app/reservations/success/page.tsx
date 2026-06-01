import { confirmReservationPaymentAction } from "@/lib/actions/reservations";

export default async function ReservationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  // Stripe redirects the browser back here after payment. The webhook (the production
  // confirmation path) can't reach localhost in dev, so we confirm by verifying the
  // session directly with Stripe. Falls back gracefully if it isn't paid yet.
  let confirmed = false;
  if (session_id) {
    const result = await confirmReservationPaymentAction(session_id);
    confirmed = result.ok && result.data.paid;
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">
        {confirmed ? "Payment confirmed" : "Payment received"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {confirmed
          ? "Your ticket is confirmed and now active in your reservations."
          : "Your ticket is being confirmed and will appear in your reservations shortly."}
      </p>
      <a
        href="/dashboard/reservations"
        className="mt-6 inline-block text-primary hover:underline"
      >
        View my reservations
      </a>
    </div>
  );
}
