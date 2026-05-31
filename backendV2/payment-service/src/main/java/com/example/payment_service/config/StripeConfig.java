package com.example.payment_service.config;

import com.stripe.Stripe;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StripeConfig {

    @Value("${app.stripe.secret-key}")
    private String secretKey;

    @PostConstruct
    void init() {
        if (secretKey != null && !secretKey.isBlank()) {
            Stripe.apiKey = secretKey;
        }
    }
}
