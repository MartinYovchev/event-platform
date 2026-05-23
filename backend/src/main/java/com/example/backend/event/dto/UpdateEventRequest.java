package com.example.backend.event.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

// PATCH semantics: only non-null fields are applied. The service decides which
// fields are legal based on the event's current status.
public record UpdateEventRequest(
        @Size(max = 200) String title,
        @Size(max = 5000) String description,
        @Size(max = 500) String location,
        @Future Instant startAt,
        @Future Instant endAt,
        @Min(1) Integer capacity,
        @DecimalMin("0.00") BigDecimal price,
        @Size(max = 1000) String coverImageUrl,
        @Min(0) @Max(168) Integer cancellationCutoffHours
) {}
