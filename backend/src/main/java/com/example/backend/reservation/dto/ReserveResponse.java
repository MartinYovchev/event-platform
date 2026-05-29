package com.example.backend.reservation.dto;

public record ReserveResponse(ReservationResponse reservation, String checkoutUrl) {}
