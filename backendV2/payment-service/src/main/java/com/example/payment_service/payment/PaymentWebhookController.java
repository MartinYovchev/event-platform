package com.example.payment_service.payment;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
public class PaymentWebhookController {

    private final PaymentService paymentService;

    public PaymentWebhookController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> webhook(@RequestBody String payload,
                                          @RequestHeader("Stripe-Signature") String signature) {
        paymentService.handleWebhook(payload, signature);
        return ResponseEntity.ok("ok");
    }
}
