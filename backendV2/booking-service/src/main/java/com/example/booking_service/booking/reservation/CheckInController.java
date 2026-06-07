package com.example.booking_service.booking.reservation;

import com.example.booking_service.booking.common.Claims;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
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
public class CheckInController {

    private final CheckInTokenService checkInTokenService;
    private final ReservationService reservationService;

    public CheckInController(CheckInTokenService checkInTokenService,
                             ReservationService reservationService) {
        this.checkInTokenService = checkInTokenService;
        this.reservationService = reservationService;
    }

    public record CheckInRequest(@NotBlank String token) {}

    @GetMapping("/api/events/{eventId}/check-in/preview")
    public ReservationService.CheckInView preview(@PathVariable Long eventId,
                                                  @RequestParam("token") String token,
                                                  @AuthenticationPrincipal Jwt jwt) {
        Long uid = organizer(jwt);
        CheckInTokenService.CheckInClaims claims = verified(token, eventId);
        return reservationService.previewCheckIn(uid, eventId, claims.reservationId());
    }

    @PostMapping("/api/events/{eventId}/check-in")
    public ReservationService.CheckInView confirm(@PathVariable Long eventId,
                                                  @Valid @RequestBody CheckInRequest req,
                                                  @AuthenticationPrincipal Jwt jwt) {
        Long uid = organizer(jwt);
        CheckInTokenService.CheckInClaims claims = verified(req.token(), eventId);
        return reservationService.confirmCheckIn(uid, eventId, claims.reservationId());
    }

    private Long organizer(Jwt jwt) {
        Long uid = ReservationService.requireUid(jwt);
        if (!Claims.isOrganizer(jwt)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not an organizer");
        }
        return uid;
    }

    private CheckInTokenService.CheckInClaims verified(String token, Long eventId) {
        CheckInTokenService.CheckInClaims claims = checkInTokenService.verify(token);
        if (!eventId.equals(claims.eventId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token does not match this event");
        }
        return claims;
    }
}
