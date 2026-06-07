package com.example.booking_service.booking.reservation;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

/**
 * Mints and verifies the signed token embedded in a reservation's QR code. The token is an
 * HS256 JWT — signed (tamper-proof) but not encrypted, so the organizer's scanner can read the
 * attendee's identity to confirm it's really them. The secret never leaves booking-service:
 * this service both mints (at confirmation) and verifies (at check-in), so notification-service
 * only ever handles the opaque token string.
 */
@Service
public class CheckInTokenService {

    private final byte[] secret;
    private final Duration grace;

    public record CheckInClaims(Long reservationId, Long eventId, Long userId,
                                String name, String email) {}

    public CheckInTokenService(
            @Value("${app.checkin.secret:change-me-dev-only-checkin-secret-please-override-0123456789}") String secret,
            @Value("${app.checkin.grace-hours:6}") long graceHours) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.grace = Duration.ofHours(graceHours);
    }

    public String mint(Reservation r) {
        try {
            Instant expiry = r.getEvent().getEndAt().plus(grace);
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .claim("rid", r.getId())
                    .claim("eid", r.getEvent().getId())
                    .claim("uid", r.getUserId())
                    .claim("name", r.getUserName())
                    .claim("email", r.getUserEmail())
                    .issueTime(Date.from(Instant.now()))
                    .expirationTime(Date.from(expiry))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            JWSSigner signer = new MACSigner(secret);
            jwt.sign(signer);
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to mint check-in token", e);
        }
    }

    public CheckInClaims verify(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            JWSVerifier verifier = new MACVerifier(secret);
            if (!jwt.verify(verifier)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid check-in token");
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            Date exp = claims.getExpirationTime();
            if (exp == null || exp.toInstant().isBefore(Instant.now())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Check-in token expired");
            }
            return new CheckInClaims(
                    claims.getLongClaim("rid"),
                    claims.getLongClaim("eid"),
                    claims.getLongClaim("uid"),
                    claims.getStringClaim("name"),
                    claims.getStringClaim("email"));
        } catch (ParseException | JOSEException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Malformed check-in token");
        }
    }
}
