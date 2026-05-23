package com.example.backend.reservation.dto;

import com.example.backend.reservation.Reservation;

import java.time.Instant;

public record ReservationResponse(
        Long id,
        Long eventId,
        String eventTitle,
        Instant eventStartAt,
        Integer quantity,
        String status,
        Instant createdAt
) {
    public static ReservationResponse from(Reservation r) {
        return new ReservationResponse(
                r.getId(),
                r.getEvent().getId(),
                r.getEvent().getTitle(),
                r.getEvent().getStartAt(),
                r.getQuantity(),
                r.getStatus().name(),
                r.getCreatedAt()
        );
    }
}
