package com.example.booking_service.booking.reservation;

import com.example.booking_service.booking.common.Claims;
import com.example.booking_service.booking.reservation.dto.CreateReservationRequest;
import com.example.booking_service.booking.reservation.dto.ReservationResponse;
import com.example.booking_service.booking.reservation.dto.ReserveResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
            @AuthenticationPrincipal Jwt jwt) {
        Long uid = ReservationService.requireUid(jwt);
        ReservationService.ReserveResult result =
                reservationService.reserve(uid, jwt.getSubject(), Claims.name(jwt), eventId, req);
        ReserveResponse body = new ReserveResponse(
                ReservationResponse.from(result.reservation()), result.checkoutUrl());
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/api/reservations/mine")
    public Page<ReservationResponse> mine(
            @RequestParam(defaultValue = "upcoming") String when,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Jwt jwt) {
        return reservationService.listMine(ReservationService.requireUid(jwt), when, page, size)
                .map(ReservationResponse::from);
    }

    @PostMapping("/api/reservations/{id}/cancel")
    public ReservationResponse cancel(@PathVariable("id") Long reservationId,
                                      @AuthenticationPrincipal Jwt jwt) {
        return ReservationResponse.from(reservationService.cancel(ReservationService.requireUid(jwt), reservationId));
    }
}
