package com.example.booking_service.booking.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String PAYMENTS_EXCHANGE = "payments.exchange";
    public static final String USERS_EXCHANGE = "users.exchange";
    public static final String RESERVATIONS_EXCHANGE = "reservations.exchange";

    public static final String PAYMENT_CONFIRMED_KEY = "payment.confirmed";
    public static final String PAYMENT_EXPIRED_KEY = "payment.expired";
    public static final String USER_DELETED_KEY = "user.deleted";
    public static final String RESERVATION_CONFIRMED_KEY = "reservation.confirmed";

    public static final String BOOKING_PAYMENTS_QUEUE = "booking.payments";
    public static final String BOOKING_USERS_QUEUE = "booking.users";

    @Bean
    public TopicExchange paymentsExchange() {
        return new TopicExchange(PAYMENTS_EXCHANGE, true, false);
    }

    @Bean
    public TopicExchange usersExchange() {
        return new TopicExchange(USERS_EXCHANGE, true, false);
    }

    @Bean
    public TopicExchange reservationsExchange() {
        return new TopicExchange(RESERVATIONS_EXCHANGE, true, false);
    }

    @Bean
    public Queue bookingPaymentsQueue() {
        return QueueBuilder.durable(BOOKING_PAYMENTS_QUEUE).build();
    }

    @Bean
    public Queue bookingUsersQueue() {
        return QueueBuilder.durable(BOOKING_USERS_QUEUE).build();
    }

    @Bean
    public Binding paymentConfirmedBinding() {
        return BindingBuilder.bind(bookingPaymentsQueue()).to(paymentsExchange()).with(PAYMENT_CONFIRMED_KEY);
    }

    @Bean
    public Binding paymentExpiredBinding() {
        return BindingBuilder.bind(bookingPaymentsQueue()).to(paymentsExchange()).with(PAYMENT_EXPIRED_KEY);
    }

    @Bean
    public Binding userDeletedBinding() {
        return BindingBuilder.bind(bookingUsersQueue()).to(usersExchange()).with(USER_DELETED_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new JacksonJsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter converter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(converter);
        return template;
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
