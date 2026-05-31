package com.example.payment_service.payment;

import com.example.payment_service.payment.dto.CheckoutRequest;
import com.example.payment_service.payment.dto.CheckoutResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/payments")
public class InternalPaymentController {

    private final PaymentService paymentService;

    public InternalPaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/checkout")
    public CheckoutResponse checkout(@RequestBody CheckoutRequest req) {
        return new CheckoutResponse(paymentService.createCheckout(req));
    }
}
