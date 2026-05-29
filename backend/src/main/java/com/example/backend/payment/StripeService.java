package com.example.backend.payment;

import com.example.backend.event.Event;
import com.example.backend.reservation.Reservation;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
public class StripeService {
    private final String secretKey;
    private final String webhookSecret;
    private final String currency;
    private final String frontendUrl;
    private final boolean enabled;

    public StripeService(@Value("${app.stripe.secret-key}") String secretKey,
                         @Value("${app.stripe.webhook-secret}") String webhookSecret,
                         @Value("${app.stripe.currency}") String currency,
                         @Value("${app.frontend-url}") String frontendUrl) {
        this.secretKey = secretKey;
        this.webhookSecret = webhookSecret;
        this.currency = currency;
        this.frontendUrl = frontendUrl;
        this.enabled = secretKey != null && !secretKey.isBlank();
    }

    @PostConstruct
    void init() {
        if (enabled) Stripe.apiKey = secretKey;
    }

    public Session createCheckoutSession(Reservation r, Event event, int quantity, String email) {
        if (!enabled) {
            throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Payments are not configured");
        }
        long unitAmount = event.getPrice().movePointRight(2).longValueExact(); // price → cents

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendUrl + "/reservations/success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(frontendUrl + "/events/" + event.getId() + "?canceled=1")
                .setCustomerEmail(email)
                .setClientReferenceId(r.getId().toString())
                .putMetadata("reservationId", r.getId().toString())
                .putMetadata("eventId", event.getId().toString())
                .setExpiresAt(Instant.now().plusSeconds(30 * 60).getEpochSecond()) // 30-min hold (Stripe min)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity((long) quantity)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(currency)
                                .setUnitAmount(unitAmount)
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName(event.getTitle())
                                        .build())
                                .build())
                        .build())
                .build();
        try {
            return Session.create(params);
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to create payment session");
        }
    }

    public com.stripe.model.Event constructEvent(String payload, String sigHeader) {
        try {
            return Webhook.constructEvent(payload, sigHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid webhook signature");
        }
    }

}
