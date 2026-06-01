package com.example.payment_service.payment;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Confirm-on-return: called by the frontend success page with the Stripe session id.
// Verifies the payment directly with Stripe so reservations confirm without the webhook
// (which can't reach localhost in dev). The webhook remains the production path.
@RestController
@RequestMapping("/api/payments")
public class PaymentConfirmController {

    private final PaymentService paymentService;

    public PaymentConfirmController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    public record ConfirmRequest(String sessionId) {}
    public record ConfirmResponse(boolean paid) {}

    @PostMapping("/confirm")
    public ConfirmResponse confirm(@RequestBody ConfirmRequest req) {
        return new ConfirmResponse(paymentService.confirmBySession(req.sessionId()));
    }
}
