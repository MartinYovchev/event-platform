package com.example.backend.payment;

import com.example.backend.reservation.ReservationService;
import com.stripe.model.checkout.Session;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final StripeService stripeService;
    private final ReservationService reservationService;

    public PaymentController(StripeService stripeService, ReservationService reservationService) {
        this.stripeService = stripeService;
        this.reservationService = reservationService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> webhook(@RequestBody String payload,
                                          @RequestHeader("Stripe-Signature") String signature) {
        com.stripe.model.Event event = stripeService.constructEvent(payload, signature);

        switch (event.getType()) {
            case "checkout.session.completed" -> {
                Session s = (Session) event.getDataObjectDeserializer().getObject().orElseThrow();
                reservationService.confirmPayment(s.getId(), s.getPaymentIntent());
            }
            case "checkout.session.expired" -> {
                Session s = (Session) event.getDataObjectDeserializer().getObject().orElseThrow();
                reservationService.releasePendingBySession(s.getId());
            }
            default -> { /* ignore other event types */ }
        }
        return ResponseEntity.ok("ok"); // 2xx so Stripe doesn't retry
    }
}