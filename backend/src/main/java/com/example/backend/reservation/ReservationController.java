package com.example.backend.reservation;

import com.example.backend.reservation.dto.CreateReservationRequest;
import com.example.backend.reservation.dto.ReservationResponse;
import com.example.backend.reservation.dto.ReserveResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @PostMapping("/api/events/{id}/reservations")
    public ResponseEntity<ReserveResponse> reserve(
            @PathVariable("id") Long eventId,
            @Valid @RequestBody CreateReservationRequest req,
            Authentication auth) {
        ReservationService.ReserveResult result = reservationService.reserve(auth.getName(), eventId, req);
        ReserveResponse body = new ReserveResponse(
                ReservationResponse.from(result.reservation()), result.checkoutUrl());
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PostMapping("/api/me/reservations/{id}/cancel")
    public ReservationResponse cancel(@PathVariable("id") Long reservationId, Authentication auth) {
        return ReservationResponse.from(reservationService.cancel(auth.getName(), reservationId));
    }
}
