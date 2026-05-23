package com.example.backend.event.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

public record CreateEventRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 5000) String description,
        @NotBlank @Size(max = 500) String location,
        @NotNull @Future Instant startAt,
        @NotNull @Future Instant endAt,
        @NotNull @Min(1) Integer capacity,
        @NotNull @DecimalMin("0.00") BigDecimal price,
        @Size(max = 1000) String coverImageUrl,
        @Min(0) @Max(168) Integer cancellationCutoffHours
) {}
