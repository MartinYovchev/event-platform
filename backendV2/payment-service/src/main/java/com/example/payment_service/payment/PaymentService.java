package com.example.payment_service.payment;

import com.example.payment_service.messaging.PaymentEventPublisher;
import com.example.payment_service.payment.dto.CheckoutRequest;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentEventPublisher publisher;
    private final String webhookSecret;
    private final String defaultCurrency;
    private final String frontendUrl;
    private final boolean enabled;

    public PaymentService(PaymentRepository paymentRepository,
                          PaymentEventPublisher publisher,
                          @Value("${app.stripe.secret-key}") String secretKey,
                          @Value("${app.stripe.webhook-secret}") String webhookSecret,
                          @Value("${app.stripe.currency}") String defaultCurrency,
                          @Value("${app.frontend-url}") String frontendUrl) {
        this.paymentRepository = paymentRepository;
        this.publisher = publisher;
        this.webhookSecret = webhookSecret;
        this.defaultCurrency = defaultCurrency;
        this.frontendUrl = frontendUrl;
        this.enabled = secretKey != null && !secretKey.isBlank();
    }

    @Transactional
    public String createCheckout(CheckoutRequest req) {
        if (!enabled) {
            throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Payments are not configured");
        }
        String currency = (req.currency() == null || req.currency().isBlank())
                ? defaultCurrency : req.currency();

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendUrl + "/reservations/success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(frontendUrl + "/events?canceled=1")
                .setCustomerEmail(req.customerEmail())
                .setClientReferenceId(String.valueOf(req.reservationId()))
                .putMetadata("reservationId", String.valueOf(req.reservationId()))
                .setExpiresAt(Instant.now().plusSeconds(30 * 60).getEpochSecond())
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(currency)
                                .setUnitAmount(req.amountMinor())
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName(req.eventTitle())
                                        .build())
                                .build())
                        .build())
                .build();

        Session session;
        try {
            session = Session.create(params);
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to create payment session");
        }

        Payment p = new Payment();
        p.setReservationId(req.reservationId());
        p.setStripeSessionId(session.getId());
        p.setAmountMinor(req.amountMinor());
        p.setCurrency(currency);
        p.setStatus(PaymentStatus.PENDING);
        paymentRepository.save(p);

        return session.getUrl();
    }

    @Transactional
    public void handleWebhook(String payload, String signature) {
        com.stripe.model.Event event;
        try {
            event = Webhook.constructEvent(payload, signature, webhookSecret);
        } catch (SignatureVerificationException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid webhook signature");
        }

        switch (event.getType()) {
            case "checkout.session.completed" -> {
                Session s = (Session) event.getDataObjectDeserializer().getObject().orElseThrow();
                Long reservationId = markPaid(s.getId(), s.getPaymentIntent());
                if (reservationId != null) publisher.publishConfirmed(reservationId);
            }
            case "checkout.session.expired" -> {
                Session s = (Session) event.getDataObjectDeserializer().getObject().orElseThrow();
                Long reservationId = markExpired(s.getId());
                if (reservationId != null) publisher.publishExpired(reservationId);
            }
            default -> { /* ignore other event types */ }
        }
    }

    private Long markPaid(String sessionId, String paymentIntentId) {
        return paymentRepository.findByStripeSessionId(sessionId).map(p -> {
            if (p.getStatus() == PaymentStatus.PENDING) {
                p.setStatus(PaymentStatus.PAID);
                p.setStripePaymentIntentId(paymentIntentId);
                p.setPaidAt(Instant.now());
                return p.getReservationId();
            }
            return null;
        }).orElse(null);
    }

    private Long markExpired(String sessionId) {
        return paymentRepository.findByStripeSessionId(sessionId).map(p -> {
            if (p.getStatus() == PaymentStatus.PENDING) {
                p.setStatus(PaymentStatus.EXPIRED);
                return p.getReservationId();
            }
            return null;
        }).orElse(null);
    }
}
