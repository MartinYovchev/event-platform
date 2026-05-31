package com.example.auth_service.auth.messaging;

import com.example.auth_service.auth.config.RabbitConfig;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class UserEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public UserEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishUserDeleted(Long userId) {
        rabbitTemplate.convertAndSend(
                RabbitConfig.USERS_EXCHANGE,
                RabbitConfig.USER_DELETED_KEY,
                new UserDeletedEvent(userId));
    }
}
