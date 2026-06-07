package com.example.booking_service.booking.messaging;

import com.example.booking_service.booking.config.RabbitConfig;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class ReservationEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public ReservationEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishConfirmed(ReservationConfirmedEvent event) {
        rabbitTemplate.convertAndSend(
                RabbitConfig.RESERVATIONS_EXCHANGE,
                RabbitConfig.RESERVATION_CONFIRMED_KEY,
                event);
    }
}
