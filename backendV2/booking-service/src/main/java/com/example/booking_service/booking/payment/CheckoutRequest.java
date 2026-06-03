package com.example.booking_service.booking.payment;


public record CheckoutRequest(
        Long reservationId,
        String eventTitle,
        long amountMinor,
        String currency,
        String customerEmail
) {}
