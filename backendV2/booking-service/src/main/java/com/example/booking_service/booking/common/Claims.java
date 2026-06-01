package com.example.booking_service.booking.common;

import org.springframework.security.oauth2.jwt.Jwt;

public final class Claims {

    public static Long uid(Jwt jwt) {
        Object v = jwt.getClaim("uid");
        return v == null ? null : ((Number) v).longValue();
    }

    public static boolean isOrganizer(Jwt jwt) {
        return Boolean.TRUE.equals(jwt.getClaim("isOrganizer"));
    }

    public static String name(Jwt jwt) {
        return jwt.getClaimAsString("name");
    }
}
