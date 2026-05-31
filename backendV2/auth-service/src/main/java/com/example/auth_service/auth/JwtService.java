package com.example.auth_service.auth;

import com.example.auth_service.auth.config.JwtKeyConfig;
import com.example.auth_service.auth.entities.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class JwtService {

    private final JwtEncoder encoder;
    private final long expirationMinutes;
    private final String issuer;

    public JwtService(JwtEncoder encoder,
                      @Value("${app.jwt.expiration-minutes}") long expirationMinutes,
                      @Value("${app.jwt.issuer}") String issuer) {
        this.encoder = encoder;
        this.expirationMinutes = expirationMinutes;
        this.issuer = issuer;
    }

    public String issue(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plus(expirationMinutes, ChronoUnit.MINUTES))
                .subject(user.getEmail())
                .claim("uid", user.getId())
                .claim("role", user.getRole().name())
                .claim("provider", user.getProvider().name())
                .claim("isOrganizer", Boolean.TRUE.equals(user.getOrganizer()))
                .build();
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).keyId(JwtKeyConfig.KID).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public long getExpirationSeconds() {
        return expirationMinutes * 60;
    }
}
