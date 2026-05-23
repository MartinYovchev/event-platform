package com.example.backend.event.dto;

import com.example.backend.event.Event;

import java.math.BigDecimal;
import java.time.Instant;

public record EventListItemResponse(
        Long id,
        String title,
        String location,
        Instant startAt,
        Instant endAt,
        Integer capacity,
        Integer seatsTaken,
        BigDecimal price,
        String coverImageUrl
) {
    public static EventListItemResponse from(Event e) {
        return new EventListItemResponse(
                e.getId(),
                e.getTitle(),
                e.getLocation(),
                e.getStartAt(),
                e.getEndAt(),
                e.getCapacity(),
                e.getSeatsTaken(),
                e.getPrice(),
                e.getCoverImageUrl()
        );
    }
}
