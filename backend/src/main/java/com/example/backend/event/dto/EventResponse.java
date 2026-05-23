package com.example.backend.event.dto;

import com.example.backend.event.Event;

import java.math.BigDecimal;
import java.time.Instant;

public record EventResponse(
        Long id,
        Long organizerId,
        String organizerDisplayName,
        String title,
        String description,
        String location,
        Instant startAt,
        Instant endAt,
        Integer capacity,
        Integer seatsTaken,
        BigDecimal price,
        String coverImageUrl,
        String status,
        Integer cancellationCutoffHours,
        Instant createdAt
) {
    public static EventResponse from(Event e) {
        return new EventResponse(
                e.getId(),
                e.getOrganizer().getId(),
                e.getOrganizer().getDisplayName(),
                e.getTitle(),
                e.getDescription(),
                e.getLocation(),
                e.getStartAt(),
                e.getEndAt(),
                e.getCapacity(),
                e.getSeatsTaken(),
                e.getPrice(),
                e.getCoverImageUrl(),
                e.getStatus().name(),
                e.getCancellationCutoffHours(),
                e.getCreatedAt()
        );
    }
}
