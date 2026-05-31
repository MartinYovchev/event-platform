package com.example.payment_service.messaging;

import com.example.payment_service.config.RabbitConfig;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class PaymentEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public PaymentEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishConfirmed(Long reservationId) {
        rabbitTemplate.convertAndSend(
                RabbitConfig.PAYMENTS_EXCHANGE,
                RabbitConfig.PAYMENT_CONFIRMED_KEY,
                new PaymentConfirmedEvent(reservationId));
    }

    public void publishExpired(Long reservationId) {
        rabbitTemplate.convertAndSend(
                RabbitConfig.PAYMENTS_EXCHANGE,
                RabbitConfig.PAYMENT_EXPIRED_KEY,
                new PaymentExpiredEvent(reservationId));
    }
}
