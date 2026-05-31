package com.example.booking_service.booking.messaging;

// Consumer-side shape for both PaymentConfirmedEvent and PaymentExpiredEvent published by
// payment-service — they carry the same single field, so we deserialize to one record and
// branch on the routing key. The default JacksonJsonMessageConverter uses INFERRED type
// precedence with method-level @RabbitListener, so the publisher's __TypeId__ header (a
// payment-service FQN that doesn't exist here) is ignored in favor of this concrete type.
public record PaymentEvent(Long reservationId) {}
