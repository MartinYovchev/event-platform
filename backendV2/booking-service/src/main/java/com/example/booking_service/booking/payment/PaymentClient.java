package com.example.booking_service.booking.payment;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class PaymentClient {

    private final RestClient restClient;

    public PaymentClient(RestClient.Builder loadBalancedRestClientBuilder) {
        this.restClient = loadBalancedRestClientBuilder
                .baseUrl("http://payment-service")
                .build();
    }

    /** Calls payment-service to create a Stripe checkout session. Returns the checkout URL. */
    public String createCheckout(CheckoutRequest req) {
        CheckoutResponse resp = restClient.post()
                .uri("/internal/payments/checkout")
                .body(req)
                .retrieve()
                .body(CheckoutResponse.class);
        return resp == null ? null : resp.checkoutUrl();
    }
}
