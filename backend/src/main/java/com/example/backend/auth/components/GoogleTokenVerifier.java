package com.example.backend.auth.components;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

@Component
public class GoogleTokenVerifier {
    private static final String JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");

    private final NimbusJwtDecoder decoder;
    private final boolean enabled;

    public GoogleTokenVerifier(@Value("${app.google.client-id:}") String clientId) {
        this.enabled = clientId != null && !clientId.isBlank();

        NimbusJwtDecoder d = NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI).build();
        OAuth2TokenValidator<Jwt> validators = new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                jwt -> ISSUERS.contains(jwt.getClaimAsString("iss"))
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_issuer")),
                jwt -> (jwt.getAudience() != null && jwt.getAudience().contains(clientId))
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_audience"))
        );
        d.setJwtValidator(validators);
        this.decoder = d;
    }

    public GoogleUser verify(String idToken) {
        if (!enabled) {
            throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Google sign-in is not configured");
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (JwtException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google token");
        }

        String sub = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        String name = jwt.getClaimAsString("name");
        Object emailVerified = jwt.getClaims().get("email_verified");
        boolean verified = Boolean.TRUE.equals(emailVerified) || "true".equals(String.valueOf(emailVerified));

        if (sub == null || email == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token missing required claims");
        }
        if (!verified) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google email is not verified");
        }
        return new GoogleUser(sub, email, name);
    }

    public record GoogleUser(String subject, String email, String name) {}
}
