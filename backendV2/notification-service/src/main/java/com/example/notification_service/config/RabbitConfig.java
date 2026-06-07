package com.example.notification_service.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String RESERVATIONS_EXCHANGE = "reservations.exchange";
    public static final String RESERVATION_CONFIRMED_KEY = "reservation.confirmed";
    public static final String NOTIFICATIONS_RESERVATIONS_QUEUE = "notifications.reservations";

    @Bean
    public TopicExchange reservationsExchange() {
        return new TopicExchange(RESERVATIONS_EXCHANGE, true, false);
    }

    @Bean
    public Queue notificationsReservationsQueue() {
        return QueueBuilder.durable(NOTIFICATIONS_RESERVATIONS_QUEUE).build();
    }

    @Bean
    public Binding reservationConfirmedBinding() {
        return BindingBuilder.bind(notificationsReservationsQueue())
                .to(reservationsExchange()).with(RESERVATION_CONFIRMED_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new JacksonJsonMessageConverter();
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory, MessageConverter converter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(converter);
        return factory;
    }
}
