package com.example.notification_service.messaging;

import com.example.notification_service.config.RabbitConfig;
import com.example.notification_service.email.EmailService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class ReservationNotificationListener {

    private final EmailService emailService;

    public ReservationNotificationListener(EmailService emailService) {
        this.emailService = emailService;
    }

    @RabbitListener(queues = RabbitConfig.NOTIFICATIONS_RESERVATIONS_QUEUE)
    public void onReservationConfirmed(ReservationConfirmedEvent event) {
        emailService.sendReservationConfirmation(event);
    }
}
