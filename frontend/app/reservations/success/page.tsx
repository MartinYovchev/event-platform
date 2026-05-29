export default function ReservationSuccessPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Payment received</h1>
      <p className="mt-2 text-muted-foreground">
        Your ticket is being confirmed and will appear in your reservations
        shortly.
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
