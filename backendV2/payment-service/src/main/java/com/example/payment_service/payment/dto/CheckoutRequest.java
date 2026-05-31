package com.example.payment_service.payment.dto;

public record CheckoutRequest(
        Long reservationId,
        String eventTitle,
        long amountMinor,
        String currency,
        String customerEmail
) {}
