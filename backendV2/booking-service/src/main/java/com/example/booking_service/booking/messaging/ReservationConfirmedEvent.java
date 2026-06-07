package com.example.booking_service.booking.messaging;

import java.time.Instant;

public record ReservationConfirmedEvent(
        Long reservationId,
        Long eventId,
        String eventTitle,
        String eventLocation,
        Instant eventStartAt,
        Integer quantity,
        String userEmail,
        String userName,
        String qrToken) {
}
