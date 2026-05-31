package com.example.booking_service.booking.reservation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CreateReservationRequest(
        @NotNull @Min(1) @Max(20) Integer quantity
) {}
