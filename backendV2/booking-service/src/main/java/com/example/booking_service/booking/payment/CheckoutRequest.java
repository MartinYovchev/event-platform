package com.example.booking_service.booking.payment;

// Request body POSTed to payment-service's /internal/payments/checkout.
// Field names must match payment-service's copy of this DTO (no shared module).
public record CheckoutRequest(
        Long reservationId,
        String eventTitle,
        long amountMinor,
        String currency,
        String customerEmail
) {}
