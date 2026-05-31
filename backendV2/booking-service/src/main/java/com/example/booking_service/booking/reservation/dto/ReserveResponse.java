package com.example.booking_service.booking.reservation.dto;

public record ReserveResponse(ReservationResponse reservation, String checkoutUrl) {}
