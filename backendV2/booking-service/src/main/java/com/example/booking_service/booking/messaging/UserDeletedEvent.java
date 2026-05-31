package com.example.booking_service.booking.messaging;

// Duplicated (no shared module) — field names must match auth-service's copy.
public record UserDeletedEvent(Long userId) {}
