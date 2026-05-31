package com.example.booking_service.booking.messaging;

import com.example.booking_service.booking.config.RabbitConfig;
import com.example.booking_service.booking.event.EventService;
import com.example.booking_service.booking.reservation.ReservationService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

@Component
public class BookingEventListener {

    private final ReservationService reservationService;
    private final EventService eventService;

    public BookingEventListener(ReservationService reservationService, EventService eventService) {
        this.reservationService = reservationService;
        this.eventService = eventService;
    }

    @RabbitListener(queues = RabbitConfig.BOOKING_PAYMENTS_QUEUE)
    public void onPaymentEvent(PaymentEvent event,
                               @Header(AmqpHeaders.RECEIVED_ROUTING_KEY) String routingKey) {
        if (RabbitConfig.PAYMENT_CONFIRMED_KEY.equals(routingKey)) {
            reservationService.confirmPayment(event.reservationId());
        } else if (RabbitConfig.PAYMENT_EXPIRED_KEY.equals(routingKey)) {
            reservationService.releasePending(event.reservationId());
        }
    }

    @RabbitListener(queues = RabbitConfig.BOOKING_USERS_QUEUE)
    public void onUserDeleted(UserDeletedEvent event) {
        Long userId = event.userId();
        // Cascade the cross-service account deletion that auth-service deferred:
        reservationService.cancelAllForUser(userId);   // release this user's held seats
        eventService.cancelEventsForOrganizer(userId);  // cancel events they organized
    }
}
