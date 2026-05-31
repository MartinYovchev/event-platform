package com.example.auth_service.auth.messaging;

// Duplicated (no shared module) — field names must match booking-service's copy
// so JSON (de)serialization across the RabbitMQ boundary lines up.
public record UserDeletedEvent(Long userId) {}
